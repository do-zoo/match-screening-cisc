# Org Structure Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role hierarchy (parentRoleId + isUnique) to BoardRole, support multiple assignments per member/role, add tree view and toggle to the period detail page, and add CSV + PDF export of the org structure.

**Architecture:** A shared pure utility (`build-role-tree.ts`) builds depth-first trees from flat role lists — used by the roles list page, period tree query, CSV, and PDF. The period detail page gains a `?view=tree` URL toggle; tree data is fetched server-side and passed to a recursive React component. Exports use Next.js route handlers: CSV is plain text, PDF uses `@react-pdf/renderer`.

**Tech Stack:** Next.js App Router, Prisma ORM, Zod, react-hook-form, `@react-pdf/renderer`, PostgreSQL (Neon), Vitest

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify — BoardRole + BoardAssignment |
| `prisma/migrations/<ts>_add_role_hierarchy/migration.sql` | Create |
| `src/lib/management/build-role-tree.ts` | Create — pure tree builder utility |
| `src/lib/management/build-role-tree.test.ts` | Create — unit tests |
| `src/lib/forms/admin-board-role-schema.ts` | Modify — add isUnique, parentRoleId |
| `src/lib/actions/admin-board-roles.ts` | Modify — handle new fields |
| `src/lib/management/query-admin-board-roles.ts` | Modify — tree-ordered query |
| `src/lib/actions/admin-board-assignments.ts` | Modify — isUnique enforcement |
| `src/lib/management/query-admin-period-tree.ts` | Create — period org tree query |
| `src/components/admin/management-role-form-dialog.tsx` | Modify — parentRoleId + isUnique fields |
| `src/components/admin/management-roles-page.tsx` | Modify — tree display with indentation |
| `src/app/admin/management/roles/page.tsx` | Modify — pass all roles for tree |
| `src/components/admin/management-assignment-form-dialog.tsx` | Modify — defaultRoleId prop |
| `src/components/admin/management-period-detail.tsx` | Modify — toggle + tree view |
| `src/app/admin/management/[periodId]/page.tsx` | Modify — ?view param + tree data |
| `src/app/admin/management/[periodId]/export-csv/route.ts` | Create |
| `src/app/admin/management/[periodId]/export-pdf/route.ts` | Create |

---

## Task 1: Schema changes + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration SQL

- [ ] **Step 1: Update `prisma/schema.prisma` — BoardRole**

In the `BoardRole` model, add two new fields after `isActive`:

```prisma
model BoardRole {
  id           String      @id @default(cuid())
  title        String
  sortOrder    Int         @default(0)
  isActive     Boolean     @default(true)
  isUnique     Boolean     @default(true)
  parentRoleId String?
  parent       BoardRole?  @relation("RoleHierarchy", fields: [parentRoleId], references: [id], onDelete: SetNull)
  children     BoardRole[] @relation("RoleHierarchy")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assignments BoardAssignment[]

  @@index([isActive, sortOrder])
  @@index([parentRoleId])
}
```

- [ ] **Step 2: Update `prisma/schema.prisma` — BoardAssignment**

Remove both `@@unique` constraints from `BoardAssignment` and replace with plain indexes:

```prisma
model BoardAssignment {
  id                 String           @id @default(cuid())
  boardPeriodId      String
  boardPeriod        BoardPeriod      @relation(fields: [boardPeriodId], references: [id], onDelete: Cascade)
  managementMemberId String
  managementMember   ManagementMember @relation(fields: [managementMemberId], references: [id], onDelete: Cascade)
  boardRoleId        String
  boardRole          BoardRole        @relation(fields: [boardRoleId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([boardPeriodId, managementMemberId])
  @@index([boardPeriodId, boardRoleId])
}
```

- [ ] **Step 3: Generate migration**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm prisma migrate dev --create-only --name add_role_hierarchy
```

Note the generated migration directory path.

- [ ] **Step 4: Replace generated `migration.sql`**

Open the generated `migration.sql` and replace its contents:

```sql
-- Add isUnique to BoardRole (default true for existing rows)
ALTER TABLE "BoardRole" ADD COLUMN "isUnique" BOOLEAN NOT NULL DEFAULT true;

-- Add parentRoleId self-reference (nullable)
ALTER TABLE "BoardRole" ADD COLUMN "parentRoleId" TEXT;
ALTER TABLE "BoardRole" ADD CONSTRAINT "BoardRole_parentRoleId_fkey"
  FOREIGN KEY ("parentRoleId") REFERENCES "BoardRole"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "BoardRole_parentRoleId_idx" ON "BoardRole"("parentRoleId");

-- Drop the two unique constraints on BoardAssignment
DROP INDEX IF EXISTS "BoardAssignment_boardPeriodId_managementMemberId_key";
DROP INDEX IF EXISTS "BoardAssignment_boardPeriodId_boardRoleId_key";

-- Add plain indexes (if not already present with these names)
CREATE INDEX IF NOT EXISTS "BoardAssignment_boardPeriodId_managementMemberId_idx"
  ON "BoardAssignment"("boardPeriodId", "managementMemberId");
CREATE INDEX IF NOT EXISTS "BoardAssignment_boardPeriodId_boardRoleId_idx"
  ON "BoardAssignment"("boardPeriodId", "boardRoleId");
```

- [ ] **Step 5: Apply migration and regenerate client**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm prisma migrate dev
pnpm prisma generate
```

Expected: migration applied, Prisma Client generated.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add role hierarchy (parentRoleId, isUnique) and remove BoardAssignment unique constraints"
```

---

## Task 2: Build-role-tree utility (TDD)

**Files:**
- Create: `src/lib/management/build-role-tree.ts`
- Create: `src/lib/management/build-role-tree.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/management/build-role-tree.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildRoleTree, flattenTreeDepthFirst } from "./build-role-tree";

const roles = [
  { id: "r1", title: "Ketua", sortOrder: 1, isUnique: true, isActive: true, parentRoleId: null },
  { id: "r2", title: "Sekretaris", sortOrder: 2, isUnique: true, isActive: true, parentRoleId: "r1" },
  { id: "r3", title: "Staf Sekretaris", sortOrder: 1, isUnique: false, isActive: true, parentRoleId: "r2" },
  { id: "r4", title: "Bendahara", sortOrder: 3, isUnique: true, isActive: true, parentRoleId: "r1" },
  { id: "r5", title: "Divisi X", sortOrder: 10, isUnique: false, isActive: true, parentRoleId: null },
];

describe("buildRoleTree", () => {
  it("returns root nodes (no parent)", () => {
    const tree = buildRoleTree(roles);
    expect(tree.map((n) => n.id)).toEqual(["r1", "r5"]);
  });

  it("attaches children to parent sorted by sortOrder", () => {
    const tree = buildRoleTree(roles);
    const ketua = tree.find((n) => n.id === "r1")!;
    // r2 (sortOrder=2) comes before r4 (sortOrder=3)
    expect(ketua.children.map((c) => c.id)).toEqual(["r2", "r4"]);
  });

  it("handles orphan parentRoleId gracefully — treats as root", () => {
    const withOrphan = [
      ...roles,
      { id: "r6", title: "Orphan", sortOrder: 99, isUnique: true, isActive: true, parentRoleId: "nonexistent" },
    ];
    const tree = buildRoleTree(withOrphan);
    expect(tree.map((n) => n.id)).toContain("r6");
  });
});

describe("flattenTreeDepthFirst", () => {
  it("returns nodes in depth-first order with correct depth", () => {
    const tree = buildRoleTree(roles);
    const flat = flattenTreeDepthFirst(tree);
    expect(flat.map((f) => f.node.id)).toEqual(["r1", "r2", "r3", "r4", "r5"]);
    expect(flat.map((f) => f.depth)).toEqual([0, 1, 2, 1, 0]);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm vitest run src/lib/management/build-role-tree.test.ts
```

Expected: FAIL — `build-role-tree` not found.

- [ ] **Step 3: Implement `build-role-tree.ts`**

Create `src/lib/management/build-role-tree.ts`:

```typescript
export type RoleFlatNode = {
  id: string;
  title: string;
  sortOrder: number;
  isUnique: boolean;
  isActive: boolean;
  parentRoleId: string | null;
};

export type RoleTreeNode = RoleFlatNode & {
  children: RoleTreeNode[];
};

export function buildRoleTree(flat: RoleFlatNode[]): RoleTreeNode[] {
  const byId = new Map<string, RoleTreeNode>(
    flat.map((r) => [r.id, { ...r, children: [] }]),
  );

  const roots: RoleTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentRoleId ? byId.get(node.parentRoleId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortBy = (a: RoleTreeNode, b: RoleTreeNode) =>
    a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "id");

  function sort(nodes: RoleTreeNode[]): void {
    nodes.sort(sortBy);
    for (const n of nodes) sort(n.children);
  }
  sort(roots);

  return roots;
}

export function flattenTreeDepthFirst(
  nodes: RoleTreeNode[],
  depth = 0,
): Array<{ node: RoleTreeNode; depth: number }> {
  const result: Array<{ node: RoleTreeNode; depth: number }> = [];
  for (const node of nodes) {
    result.push({ node, depth });
    result.push(...flattenTreeDepthFirst(node.children, depth + 1));
  }
  return result;
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pnpm vitest run src/lib/management/build-role-tree.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/management/build-role-tree.ts src/lib/management/build-role-tree.test.ts
git commit -m "feat(management): add buildRoleTree + flattenTreeDepthFirst utility"
```

---

## Task 3: Update board role schema + action

**Files:**
- Modify: `src/lib/forms/admin-board-role-schema.ts`
- Modify: `src/lib/actions/admin-board-roles.ts`

- [ ] **Step 1: Replace `admin-board-role-schema.ts`**

```typescript
import { z } from "zod";

export const adminBoardRoleCreateSchema = z.object({
  title: z.string().trim().min(1, "Nama jabatan wajib."),
  sortOrder: z.coerce.number().int().default(0),
  isUnique: z.boolean().default(true),
  parentRoleId: z.string().min(1).nullable().optional(),
});

export const adminBoardRoleUpdateSchema = adminBoardRoleCreateSchema.extend({
  id: z.string().min(1),
});

export const deleteBoardRoleSchema = z.object({
  id: z.string().min(1),
});
```

- [ ] **Step 2: Update `createBoardRole` in `admin-board-roles.ts`**

In the `prisma.boardRole.create` call, add the new fields:

```typescript
  const row = await prisma.boardRole.create({
    data: {
      title: parsed.data.title,
      sortOrder: parsed.data.sortOrder,
      isUnique: parsed.data.isUnique ?? true,
      parentRoleId: parsed.data.parentRoleId ?? null,
    },
    select: { id: true },
  });
```

- [ ] **Step 3: Update `updateBoardRole` in `admin-board-roles.ts`**

Before the update, validate parentRoleId is not the role itself or a descendant:

```typescript
  if (parsed.data.parentRoleId) {
    // Prevent self-reference
    if (parsed.data.parentRoleId === parsed.data.id) {
      return rootError("Jabatan tidak dapat menjadi induk dari dirinya sendiri.");
    }
    // Prevent circular: walk up from parentRoleId to see if we'd reach parsed.data.id
    let cursor: string | null = parsed.data.parentRoleId;
    while (cursor !== null) {
      const row = await prisma.boardRole.findUnique({
        where: { id: cursor },
        select: { parentRoleId: true },
      });
      if (!row) break;
      if (row.parentRoleId === parsed.data.id) {
        return rootError("Jabatan tidak dapat menjadi induk dari turunannya sendiri.");
      }
      cursor = row.parentRoleId;
    }
  }
```

Then in the `prisma.boardRole.update` call:

```typescript
    await prisma.boardRole.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        sortOrder: parsed.data.sortOrder,
        isUnique: parsed.data.isUnique ?? true,
        parentRoleId: parsed.data.parentRoleId ?? null,
      },
    });
```

- [ ] **Step 4: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "board-role" || echo "No errors"
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/forms/admin-board-role-schema.ts src/lib/actions/admin-board-roles.ts
git commit -m "feat(actions): board roles — add isUnique and parentRoleId support"
```

---

## Task 4: Update board role query — tree-ordered list

**Files:**
- Modify: `src/lib/management/query-admin-board-roles.ts`

- [ ] **Step 1: Add `isUnique` and `parentRoleId` to `AdminBoardRoleRowVm`**

```typescript
export type AdminBoardRoleRowVm = {
  id: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  isUnique: boolean;
  parentRoleId: string | null;
};
```

Update `listBoardRolesForAdmin` to include the new fields:

```typescript
  return prisma.boardRole.findMany({
    where: boardRoleAdminWhere(opts),
    select: { id: true, title: true, sortOrder: true, isActive: true, isUnique: true, parentRoleId: true },
    orderBy: { sortOrder: "asc" },
    skip: opts.skip,
    take: opts.take,
  });
```

- [ ] **Step 2: Add `listAllBoardRolesForAdminTree`**

Add a new export at the bottom of the file — fetches ALL roles (no filter, no pagination) for tree display:

```typescript
/** Fetches all board roles for tree rendering (no pagination). Used when no filter/search is active. */
export async function listAllBoardRolesForAdminTree(): Promise<AdminBoardRoleRowVm[]> {
  return prisma.boardRole.findMany({
    select: { id: true, title: true, sortOrder: true, isActive: true, isUnique: true, parentRoleId: true },
    orderBy: { sortOrder: "asc" },
  });
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "query-admin-board-roles" || echo "No errors"
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/management/query-admin-board-roles.ts
git commit -m "feat(management): board role query — add isUnique, parentRoleId, tree fetch"
```

---

## Task 5: Update `ManagementRoleFormDialog` — parent + isUnique fields

**Files:**
- Modify: `src/components/admin/management-role-form-dialog.tsx`

- [ ] **Step 1: Add new prop types**

Update the `RoleRow` type and `Props`:

```typescript
type RoleRow = {
  id: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  isUnique: boolean;
  parentRoleId: string | null;
};

type RoleOption = { id: string; title: string };

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRow | null;
  /** All active roles — used for parent selector. */
  allRoles: RoleOption[];
  onSaved: () => void;
  defaultShowDeactivateConfirm?: boolean;
};
```

- [ ] **Step 2: Update `FormValues` and `defaultValues`**

```typescript
type FormValues = {
  id?: string;
  title: string;
  sortOrder: string;
  isUnique: boolean;
  parentRoleId: string;  // empty string = no parent
};
```

```typescript
  const defaultValues = useMemo<FormValues>(
    () => ({
      id: role?.id,
      title: role?.title ?? "",
      sortOrder: String(role?.sortOrder ?? 0),
      isUnique: role?.isUnique ?? true,
      parentRoleId: role?.parentRoleId ?? "",
    }),
    [role],
  );
```

- [ ] **Step 3: Update the `submit` function**

```typescript
  function submit(values: FormValues) {
    if (mode === "edit" && !role) {
      dispatchExtras({ type: "set-root-message", message: "Data jabatan tidak ditemukan." });
      return;
    }
    dispatchExtras({ type: "set-root-message", message: null });
    startTransition(async () => {
      const fd = new FormData();
      const parentRoleId = values.parentRoleId.trim() || null;
      const payload =
        mode === "create"
          ? { title: values.title, sortOrder: Number(values.sortOrder), isUnique: values.isUnique, parentRoleId }
          : { id: role!.id, title: values.title, sortOrder: Number(values.sortOrder), isUnique: values.isUnique, parentRoleId };
      fd.set("payload", JSON.stringify(payload));
      const result =
        mode === "create"
          ? await createBoardRole(undefined, fd)
          : await updateBoardRole(undefined, fd);
      if (!result.ok) {
        for (const [f, m] of Object.entries(result.fieldErrors ?? {}))
          form.setError(f as keyof FormValues, { message: m });
        dispatchExtras({ type: "set-root-message", message: result.rootError ?? "Terjadi kesalahan." });
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }
```

- [ ] **Step 4: Add parent role and isUnique fields to the form JSX**

After the existing `sortOrder` field in the form, add:

```tsx
          {/* Parent role selector */}
          <Field label="Jabatan induk" htmlFor="role-parent">
            <Controller
              control={form.control}
              name="parentRoleId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger id="role-parent" size="default" className="h-10 w-full">
                    <SelectValue placeholder="— Tidak ada induk —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Tidak ada induk —</SelectItem>
                    {props.allRoles
                      .filter((r) => r.id !== role?.id)
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {/* Capacity */}
          <Field label="Kapasitas" htmlFor="role-unique">
            <Controller
              control={form.control}
              name="isUnique"
              render={({ field }) => (
                <Select
                  value={field.value ? "1" : "many"}
                  onValueChange={(v) => field.onChange(v === "1")}
                  disabled={isPending}
                >
                  <SelectTrigger id="role-unique" size="default" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Hanya 1 orang per periode</SelectItem>
                    <SelectItem value="many">Boleh banyak orang</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
```

Add the missing imports at the top of the file:

```typescript
import { Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

- [ ] **Step 5: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "management-role-form" || echo "No errors"
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/management-role-form-dialog.tsx
git commit -m "feat(ui): role form dialog — add parentRoleId and isUnique fields"
```

---

## Task 6: Update roles list page — hierarchical display

**Files:**
- Modify: `src/components/admin/management-roles-page.tsx`
- Modify: `src/app/admin/management/roles/page.tsx`

- [ ] **Step 1: Update `ManagementRolesPage` props type**

Add `allRolesForTree` prop (used for tree mode and as options in the form dialog):

```typescript
type Props = {
  roles: AdminBoardRoleRowVm[];        // paginated flat list (filter/search active)
  allRolesForTree: AdminBoardRoleRowVm[]; // full list for tree mode (empty when filter active)
  directoryEmpty: boolean;
  pagination: { page: number; pageSize: number; totalItems: number };
  filter: BoardRoleAdminFilter;
  searchQuery: string;
  tabCounts: { all: number; active: number; inactive: number };
};
```

- [ ] **Step 2: Add tree rendering to `ManagementRolesPage`**

At the top of the component, compute tree state:

```typescript
import { buildRoleTree, flattenTreeDepthFirst } from "@/lib/management/build-role-tree";

// Inside the component:
const isTreeMode = props.allRolesForTree.length > 0 && props.filter === "all" && props.searchQuery.trim() === "";
const treeFlat = useMemo(() => {
  if (!isTreeMode) return [];
  const tree = buildRoleTree(props.allRolesForTree);
  return flattenTreeDepthFirst(tree);
}, [isTreeMode, props.allRolesForTree]);

const allRoleOptions = (isTreeMode ? props.allRolesForTree : props.roles).map((r) => ({
  id: r.id,
  title: r.title,
}));
```

- [ ] **Step 3: Update the roles table to show indentation in tree mode**

In the table's Jabatan column cell, replace the plain title render with:

```tsx
cell: ({ row }) => {
  if (!isTreeMode) return <span className="font-medium">{row.original.title}</span>;
  const entry = treeFlat.find((f) => f.node.id === row.original.id);
  const depth = entry?.depth ?? 0;
  return (
    <span className="font-medium" style={{ paddingLeft: depth * 20 }}>
      {depth > 0 ? <span className="mr-1 text-muted-foreground">{"└─".repeat(depth)}</span> : null}
      {row.original.title}
    </span>
  );
},
```

- [ ] **Step 4: Add Kapasitas column to the table**

Add a new column definition after the title column:

```typescript
{
  id: "isUnique",
  header: () => <span className="text-muted-foreground">Kapasitas</span>,
  cell: ({ row }) =>
    row.original.isUnique ? (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        1 orang
      </Badge>
    ) : (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
        Banyak
      </Badge>
    ),
},
```

- [ ] **Step 5: Pass `allRoles` to `ManagementRoleFormDialog`**

Find all usages of `<ManagementRoleFormDialog` in the component and add:
```tsx
allRoles={allRoleOptions}
```

- [ ] **Step 6: Update the server page `roles/page.tsx`**

When no filter and no search, also fetch all roles for tree mode:

```typescript
import {
  listAllBoardRolesForAdminTree,
  // ... existing imports
} from "@/lib/management/query-admin-board-roles";

// In the page component:
const isTreeMode = filter === "all" && !q;

const [roles, tabCounts, totalInDb, allRolesForTree] = await Promise.all([
  listBoardRolesForAdmin({ filter, q, skip, take: ADMIN_TABLE_PAGE_SIZE }),
  countBoardRolesByTabForAdmin({ q }),
  prisma.boardRole.count(),
  isTreeMode ? listAllBoardRolesForAdminTree() : Promise.resolve([]),
]);

// Pass to component:
<ManagementRolesPage
  roles={roles}
  allRolesForTree={allRolesForTree}
  // ... existing props
/>
```

- [ ] **Step 7: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep -E "management-roles|roles/page" || echo "No errors"
```

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/management-roles-page.tsx src/app/admin/management/roles/page.tsx
git commit -m "feat(ui): roles list — tree display with indentation and Kapasitas column"
```

---

## Task 7: Update `admin-board-assignments.ts` — isUnique enforcement

**Files:**
- Modify: `src/lib/actions/admin-board-assignments.ts`

- [ ] **Step 1: Update `createBoardAssignment` — fetch isUnique and enforce**

Replace the existing role check block (currently only checks `isActive`):

```typescript
  const role = await prisma.boardRole.findUnique({
    where: { id: parsed.data.boardRoleId },
    select: { isActive: true, isUnique: true },
  });
  if (!role?.isActive) {
    return rootError("Jabatan tidak aktif atau tidak ditemukan.");
  }
  if (role.isUnique) {
    const existing = await prisma.boardAssignment.count({
      where: {
        boardPeriodId: parsed.data.boardPeriodId,
        boardRoleId: parsed.data.boardRoleId,
      },
    });
    if (existing > 0) {
      return rootError("Jabatan ini hanya boleh dipegang 1 orang per periode.");
    }
  }
```

Also remove the `P2002` catch in the `try/catch` block (no longer a unique constraint violation):

```typescript
  try {
    const row = await prisma.$transaction(async (tx) => {
      // ... existing transaction code
    });
    // ... audit log
    revalidatePath("/admin/management");
    return ok({ id: row.id });
  } catch (e) {
    console.error(e);
    return rootError("Gagal menyimpan penugasan.");
  }
```

- [ ] **Step 2: Update `updateBoardAssignment` — enforce isUnique excluding self**

Add the same check in `updateBoardAssignment`, excluding the current assignment:

```typescript
  const role = await prisma.boardRole.findUnique({
    where: { id: parsed.data.boardRoleId },
    select: { isActive: true, isUnique: true },
  });
  if (!role?.isActive) {
    return rootError("Jabatan tidak aktif atau tidak ditemukan.");
  }
  if (role.isUnique) {
    const existing = await prisma.boardAssignment.count({
      where: {
        boardPeriodId: parsed.data.boardPeriodId,
        boardRoleId: parsed.data.boardRoleId,
        id: { not: parsed.data.id },
      },
    });
    if (existing > 0) {
      return rootError("Jabatan ini hanya boleh dipegang 1 orang per periode.");
    }
  }
```

Also remove the `P2002` catch here.

- [ ] **Step 3: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "board-assignments" || echo "No errors"
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/admin-board-assignments.ts
git commit -m "feat(actions): board assignments — enforce isUnique at application level"
```

---

## Task 8: Create period tree query

**Files:**
- Create: `src/lib/management/query-admin-period-tree.ts`

- [ ] **Step 1: Create the file**

```typescript
import { prisma } from "@/lib/db/prisma";
import { buildRoleTree, flattenTreeDepthFirst } from "@/lib/management/build-role-tree";

export type PeriodTreeAssignee = {
  assignmentId: string;
  memberId: string;
  fullName: string;
  publicCode: string;
  masterMemberId: string | null;
};

export type PeriodTreeRow = {
  roleId: string;
  roleTitle: string;
  roleIsUnique: boolean;
  parentRoleId: string | null;
  depth: number;
  assignees: PeriodTreeAssignee[];
};

export async function listPeriodRolesAsTree(
  boardPeriodId: string,
): Promise<PeriodTreeRow[]> {
  const [roles, assignments] = await Promise.all([
    prisma.boardRole.findMany({
      select: {
        id: true,
        title: true,
        sortOrder: true,
        isUnique: true,
        isActive: true,
        parentRoleId: true,
      },
    }),
    prisma.boardAssignment.findMany({
      where: { boardPeriodId },
      select: {
        id: true,
        boardRoleId: true,
        managementMember: {
          select: {
            id: true,
            fullName: true,
            publicCode: true,
            masterMemberId: true,
          },
        },
      },
    }),
  ]);

  // Group assignees by roleId
  const assigneesByRole = new Map<string, PeriodTreeAssignee[]>();
  for (const a of assignments) {
    const list = assigneesByRole.get(a.boardRoleId) ?? [];
    list.push({
      assignmentId: a.id,
      memberId: a.managementMember.id,
      fullName: a.managementMember.fullName,
      publicCode: a.managementMember.publicCode,
      masterMemberId: a.managementMember.masterMemberId,
    });
    assigneesByRole.set(a.boardRoleId, list);
  }

  const tree = buildRoleTree(roles);
  const flat = flattenTreeDepthFirst(tree);

  return flat.map(({ node, depth }) => ({
    roleId: node.id,
    roleTitle: node.title,
    roleIsUnique: node.isUnique,
    parentRoleId: node.parentRoleId,
    depth,
    assignees: assigneesByRole.get(node.id) ?? [],
  }));
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "query-admin-period-tree" || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/management/query-admin-period-tree.ts
git commit -m "feat(management): add period tree query"
```

---

## Task 9: Update `ManagementAssignmentFormDialog` — defaultRoleId

**Files:**
- Modify: `src/components/admin/management-assignment-form-dialog.tsx`

- [ ] **Step 1: Add `defaultRoleId` to `CreateProps`**

```typescript
type CreateProps = {
  mode: "create";
  boardPeriodId: string;
  availableMembers: MemberOption[];
  availableRoles: RoleOption[];
  defaultRoleId?: string;   // pre-select role (e.g. from tree view click)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};
```

- [ ] **Step 2: Use `defaultRoleId` in `defaultValues`**

```typescript
  const defaultValues = useMemo(() => {
    if (props.mode === "create") {
      return {
        boardPeriodId: props.boardPeriodId,
        managementMemberId: "",
        boardRoleId: props.defaultRoleId ?? "",
      } as CreateFormValues;
    }
    // edit mode unchanged
    return {
      id: props.assignment.id,
      boardPeriodId: props.boardPeriodId,
      managementMemberId: props.assignment.managementMember.id,
      boardRoleId: props.assignment.boardRole.id,
    } as EditFormValues;
  }, [props]);
```

- [ ] **Step 3: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "management-assignment-form" || echo "No errors"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/management-assignment-form-dialog.tsx
git commit -m "feat(ui): assignment dialog — add defaultRoleId prop for tree view"
```

---

## Task 10: Period detail — toggle view + tree component

**Files:**
- Modify: `src/components/admin/management-period-detail.tsx`
- Modify: `src/app/admin/management/[periodId]/page.tsx`

- [ ] **Step 1: Update `ManagementPeriodDetail` props**

Add `view`, `treeRows`, and `availableRoles` for tree view:

```typescript
import type { PeriodTreeRow } from "@/lib/management/query-admin-period-tree";

type Props = {
  period: { id: string; label: string; startsAt: Date; endsAt: Date };
  assignments: AdminPeriodAssignmentRowVm[];
  assignmentsEmpty: boolean;
  availableMembers: MemberOption[];
  availableRoles: RoleOption[];
  isActive: boolean;
  pagination: { page: number; pageSize: number; totalItems: number };
  filter: PeriodAssignmentAdminFilter;
  searchQuery: string;
  tabCounts: { all: number; linked: number; unlinked: number };
  view: "list" | "tree";
  treeRows: PeriodTreeRow[];   // empty when view === "list"
};
```

- [ ] **Step 2: Add view toggle buttons**

In the header row (where the "Tambah Penugasan" button is), add toggle buttons before it:

```tsx
import { LayoutListIcon, NetworkIcon } from "lucide-react";
import Link from "next/link";

// In the header div, before the "Tambah Penugasan" button:
<div className="flex items-center gap-2">
  <Link
    href={`/admin/management/${period.id}`}
    className={cn(
      buttonVariants({ variant: "outline", size: "sm" }),
      props.view === "list" && "bg-muted",
    )}
  >
    <LayoutListIcon data-icon="inline-start" />
    Daftar
  </Link>
  <Link
    href={`/admin/management/${period.id}?view=tree`}
    className={cn(
      buttonVariants({ variant: "outline", size: "sm" }),
      props.view === "tree" && "bg-muted",
    )}
  >
    <NetworkIcon data-icon="inline-start" />
    Struktur
  </Link>
</div>
```

Add `buttonVariants` import from `@/components/ui/button` and `cn` from `@/lib/utils`.

- [ ] **Step 3: Add tree view state and rendering**

Add `const [treeAddRoleId, setTreeAddRoleId] = useState<string | undefined>(undefined);` alongside the existing `createOpen` state.

Find the `{assignmentsEmpty ? ( ... ) : ( ... )}` block (the empty-state message and the filter+table `<div>`). Wrap the entire block in:

```tsx
{props.view === "list" && (
  <>
    {assignmentsEmpty ? ( ... ) : ( ... )}
  </>
)}
```

Then add the tree view block directly after the closing `)}` of that conditional:

```tsx
{props.view === "tree" && (
  <div className="rounded-lg border">
    {props.treeRows.length === 0 ? (
      <p className="px-4 py-6 text-sm text-muted-foreground">
        Belum ada jabatan. Tambahkan jabatan di halaman{" "}
        <Link href="/admin/management/roles" className="underline">
          Jabatan
        </Link>{" "}
        terlebih dahulu.
      </p>
    ) : (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/40">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Jabatan</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Pemegang</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {props.treeRows.map((row) => (
            <tr key={row.roleId} className="border-t hover:bg-muted/20">
              <td className="px-4 py-2.5" style={{ paddingLeft: 16 + row.depth * 20 }}>
                {row.depth > 0 && (
                  <span className="mr-1 text-muted-foreground">{"└─"}</span>
                )}
                <span className={cn("font-medium", row.assignees.length === 0 && "text-muted-foreground")}>
                  {row.roleTitle}
                </span>
                {!row.roleIsUnique && (
                  <Badge className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                    Banyak
                  </Badge>
                )}
              </td>
              <td className="px-4 py-2.5">
                {row.assignees.length === 0 ? (
                  <span className="text-muted-foreground italic">Belum diisi</span>
                ) : (
                  <span>
                    {row.assignees.map((a, i) => (
                      <span key={a.assignmentId}>
                        {a.fullName}
                        {a.masterMemberId && (
                          <span className="ml-1 text-xs text-green-600 dark:text-green-400">· direktori</span>
                        )}
                        {i < row.assignees.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTreeAddRoleId(row.roleId);
                    setCreateOpen(true);
                  }}
                >
                  + Tugaskan
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
)}
```

Update the create dialog to pass `defaultRoleId`:

```tsx
<ManagementAssignmentFormDialog
  mode="create"
  boardPeriodId={period.id}
  availableMembers={availableMembers}
  availableRoles={availableRoles}
  defaultRoleId={treeAddRoleId}
  open={createOpen}
  onOpenChange={(open) => {
    setCreateOpen(open);
    if (!open) setTreeAddRoleId(undefined);
  }}
  onSaved={router.refresh}
/>
```

- [ ] **Step 4: Add export buttons to the header**

In the header div, add export links (always visible):

```tsx
<a
  href={`/admin/management/${period.id}/export-csv`}
  className={buttonVariants({ variant: "outline", size: "sm" })}
  download
>
  Export CSV
</a>
<a
  href={`/admin/management/${period.id}/export-pdf`}
  className={buttonVariants({ variant: "outline", size: "sm" })}
  download
>
  Export PDF
</a>
```

- [ ] **Step 5: Update `[periodId]/page.tsx`**

Add `?view` parsing and tree data fetch:

```typescript
import { listPeriodRolesAsTree } from "@/lib/management/query-admin-period-tree";

// In the page, after existing searchParams parsing:
const viewRaw = firstString(sp.view);
const view: "list" | "tree" = viewRaw === "tree" ? "tree" : "list";

// In the parallel fetch, add tree data:
const [assignments, availableMembers, availableRoles, allPeriods, tabCounts, assignmentsInPeriod, treeRows] =
  await Promise.all([
    // ... existing queries ...
    view === "tree" ? listPeriodRolesAsTree(periodId) : Promise.resolve([]),
  ]);

// Pass to component:
<ManagementPeriodDetail
  // ... existing props ...
  view={view}
  treeRows={treeRows}
/>
```

- [ ] **Step 6: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep -E "period-detail|periodId" || echo "No errors"
```

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/management-period-detail.tsx src/app/admin/management/\[periodId\]/page.tsx
git commit -m "feat(ui): period detail — add tree view toggle and export buttons"
```

---

## Task 11: CSV export route

**Files:**
- Create: `src/app/admin/management/[periodId]/export-csv/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { listPeriodRolesAsTree } from "@/lib/management/query-admin-period-tree";
import { prisma } from "@/lib/db/prisma";

function escCsv(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const { periodId } = await params;

  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const period = await prisma.boardPeriod.findUnique({
    where: { id: periodId },
    select: { label: true },
  });
  if (!period) return new NextResponse("Not found", { status: 404 });

  const rows = await listPeriodRolesAsTree(periodId);

  const header = ["Jabatan", "Jabatan Induk", "Kapasitas", "Nama Pengurus", "Kode Publik", "Terhubung ke Direktori"];

  // Build parentId → title map
  const titleById = new Map(rows.map((r) => [r.roleId, r.roleTitle]));

  const lines: string[] = [header.map(escCsv).join(",")];

  for (const row of rows) {
    const parentTitle = row.parentRoleId ? (titleById.get(row.parentRoleId) ?? "") : "";
    const kapasitas = row.roleIsUnique ? "1 orang" : "Banyak";
    if (row.assignees.length === 0) {
      lines.push(
        [row.roleTitle, parentTitle, kapasitas, "", "", ""].map(escCsv).join(","),
      );
    } else {
      for (const a of row.assignees) {
        lines.push(
          [
            row.roleTitle,
            parentTitle,
            kapasitas,
            a.fullName,
            a.publicCode,
            a.masterMemberId ? "Ya" : "Tidak",
          ]
            .map(escCsv)
            .join(","),
        );
      }
    }
  }

  const csv = lines.join("\r\n");
  const filename = `struktur-kepengurusan-${period.label.replace(/\s+/g, "-")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "export-csv" || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/management/\[periodId\]/export-csv/
git commit -m "feat: period org structure CSV export"
```

---

## Task 12: PDF export route

**Files:**
- Create: `src/app/admin/management/[periodId]/export-pdf/route.ts`

- [ ] **Step 1: Install `@react-pdf/renderer`**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm add @react-pdf/renderer
```

Expected: package added to `dependencies` in `package.json`.

- [ ] **Step 2: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";
import React from "react";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { listPeriodRolesAsTree } from "@/lib/management/query-admin-period-tree";
import { prisma } from "@/lib/db/prisma";

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 40, color: "#111" },
  header: { marginBottom: 20 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555" },
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  roleCell: { flex: 2 },
  assigneeCell: { flex: 3, color: "#374151" },
  emptyAssignee: { color: "#9ca3af", fontStyle: "italic" },
});

function OrgDocument({
  periodLabel,
  dateRange,
  rows,
}: {
  periodLabel: string;
  dateRange: string;
  rows: Awaited<ReturnType<typeof listPeriodRolesAsTree>>;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Struktur Kepengurusan CISC</Text>
          <Text style={styles.subtitle}>
            Periode: {periodLabel} ({dateRange})
          </Text>
        </View>
        {rows.map((row) => {
          const indent = row.depth * 14;
          const assigneeText =
            row.assignees.length === 0
              ? "(belum diisi)"
              : row.assignees.map((a) => `${a.fullName} (${a.publicCode})`).join(", ");
          return (
            <View key={row.roleId} style={styles.row}>
              <View style={[styles.roleCell, { paddingLeft: indent }]}>
                <Text style={{ fontWeight: row.depth === 0 ? "bold" : "normal" }}>
                  {row.depth > 0 ? "└ " : ""}{row.roleTitle}
                  {!row.roleIsUnique ? " [banyak]" : ""}
                </Text>
              </View>
              <View style={styles.assigneeCell}>
                <Text style={row.assignees.length === 0 ? styles.emptyAssignee : undefined}>
                  {assigneeText}
                </Text>
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const { periodId } = await params;

  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const period = await prisma.boardPeriod.findUnique({
    where: { id: periodId },
    select: { label: true, startsAt: true, endsAt: true },
  });
  if (!period) return new NextResponse("Not found", { status: 404 });

  const rows = await listPeriodRolesAsTree(periodId);
  const dateRange = `${period.startsAt.toISOString().slice(0, 10)} – ${period.endsAt.toISOString().slice(0, 10)}`;

  const buffer = await renderToBuffer(
    <OrgDocument periodLabel={period.label} dateRange={dateRange} rows={rows} />,
  );

  const filename = `struktur-kepengurusan-${period.label.replace(/\s+/g, "-")}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "export-pdf" || echo "No errors"
```

- [ ] **Step 4: Full build check**

```bash
pnpm build
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: all tests pass including the new `build-role-tree.test.ts`.

- [ ] **Step 6: Final commit**

```bash
git add src/app/admin/management/\[periodId\]/export-pdf/ package.json pnpm-lock.yaml
git commit -m "feat: period org structure PDF export via @react-pdf/renderer"
```
