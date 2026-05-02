# Kepengurusan (`ManagementMember`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement board-period roster management (`BoardPeriod`, `BoardRole`, `ManagementMember`, `BoardAssignment`), automatic sync of `MasterMember.isManagementMember` from active assignments for linked records, public registration via **`managementPublicCode`**, admin UI at **`/admin/management`** with sidebar parity to Anggota, and **`ClubAuditLog`** actions for mutations.

**Architecture:** Store organizational structure in new Prisma models with non-overlapping period ranges validated in server actions. Extract pure helpers for “active period” (`startsAt <= now < endsAt` in UTC) and **`recomputeDirectoryManagementFlags`** so tests stay DB-free. After any mutation that affects eligibility, call recompute inside the same transaction for affected `masterMemberId` values. Public submit validates **`publicCode`** against `ManagementMember` plus active-period **`BoardAssignment`**; persist **`Registration.primaryManagementMemberId`** (and optional **`claimedManagementPublicCode`** snapshot) for admin clarity. Remove manual editing of **`isManagementMember`** on the master-member form and from CSV import writes so the directory flag stays aligned with kepengurusan.

**Tech Stack:** Next.js App Router, Prisma + PostgreSQL, Vitest, Zod, `guardOwnerOrAdmin`, `appendClubAuditLog`, existing admin shell / `deriveGlobalSidebarNav`.

---

## Spec ↔ implementation map

| Spec §                                | Where implemented |
| ------------------------------------- | ----------------- |
| 4 Models                              | Task 1–2          |
| 5 Active period & sync                | Task 2, 7, 8      |
| 6 Public registration & admin display | Task 9–11         |
| 7 Audit actions                       | Task 3, 4–7       |
| 8 UI & sidebar                        | Task 12–13        |

---

## File structure (create / modify)

| Path                                                           | Responsibility                                                                                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                         | Models `BoardPeriod`, `BoardRole`, `ManagementMember`, `BoardAssignment`; `Registration` FK `primaryManagementMemberId`; optional `claimedManagementPublicCode` |
| `prisma/migrations/<timestamp>_board_management/migration.sql` | DDL + indexes + uniques                                                                                                                                         |
| `src/lib/management/normalize-public-code.ts`                  | Single normalization rule for codes (trim + uppercase ASCII)                                                                                                    |
| `src/lib/management/active-period.ts`                          | `findActiveBoardPeriodId`, overlap check inputs                                                                                                                 |
| `src/lib/management/recompute-directory-flags.ts`              | `collectAffectedMasterMemberIds`, `recomputeIsManagementMemberForIds` (pure logic + optional Prisma caller split)                                               |
| `src/lib/management/recompute-directory-flags.test.ts`         | Unit tests for pure functions                                                                                                                                   |
| `src/lib/audit/club-audit-actions.ts`                          | New `CLUB_AUDIT_ACTION` string constants                                                                                                                        |
| `src/lib/actions/admin-board-periods.ts`                       | CRUD periods, overlap validation, audit, `revalidatePath`                                                                                                       |
| `src/lib/actions/admin-board-roles.ts`                         | CRUD roles, deactivate, audit                                                                                                                                   |
| `src/lib/actions/admin-management-members.ts`                  | CRUD `ManagementMember`, `publicCode` uniqueness, link `masterMemberId`, audit                                                                                  |
| `src/lib/actions/admin-board-assignments.ts`                   | Create/update/delete assignments, call recompute, audit                                                                                                         |
| `src/lib/admin/global-nav-flags.ts`                            | `management: boolean`                                                                                                                                           |
| `src/components/admin/admin-app-shell.tsx`                     | Nav link Kepengurusan → `/admin/management`                                                                                                                     |
| `src/app/admin/management/page.tsx`                            | RSC: auth gate, load periods                                                                                                                                    |
| `src/app/admin/management/[periodId]/page.tsx`                 | RSC: roster + CRUD entry points                                                                                                                                 |
| `src/components/admin/management-*.tsx`                        | Client tables/forms (split by focus if files exceed ~300 lines)                                                                                                 |
| `src/lib/forms/submit-registration-schema.ts`                  | Optional `managementPublicCode`; mutual exclusion with `claimedMemberNumber` when `purchaserIsMember`                                                           |
| `src/lib/actions/submit-registration.ts`                       | Resolve primary via member number **or** code; partner gate; persist new FK                                                                                     |
| `src/lib/registrations/load-admin-ticket-context.ts`           | Extend `managementMember` VM: directory vs kode publik                                                                                                          |
| `src/components/admin/registration-detail.tsx`                 | Display jalur pengurus                                                                                                                                          |
| `src/lib/forms/admin-master-member-schema.ts`                  | Drop `isManagementMember` from schemas                                                                                                                          |
| `src/components/admin/member-form-dialog.tsx`                  | Remove toggle                                                                                                                                                   |
| `src/lib/actions/admin-master-members.ts`                      | Stop persisting `isManagementMember` from UI/CSV updates                                                                                                        |
| `src/lib/members/prepare-master-member-csv-row.ts`             | Stop applying `is_management_member` from CSV (column ignored)                                                                                                  |
| `CLAUDE.md`                                                    | Short note: directory flag synced from kepengurusan                                                                                                             |

---

### Task 1: Prisma schema and migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_board_management/migration.sql` (name timestamp when you run `pnpm prisma migrate dev`)
- Modify: `CLAUDE.md` (one paragraph under MasterMember / pricing if needed)

- [ ] **Step 1: Add models** — append to `prisma/schema.prisma` (relations on `MasterMember` / `Registration` as below).

```prisma
model BoardPeriod {
  id        String   @id @default(cuid())
  label     String
  startsAt  DateTime
  endsAt    DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assignments BoardAssignment[]

  @@index([startsAt, endsAt])
}

model BoardRole {
  id        String   @id @default(cuid())
  title     String
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assignments BoardAssignment[]

  @@index([isActive, sortOrder])
}

model ManagementMember {
  id             String   @id @default(cuid())
  publicCode     String   @unique
  fullName       String
  whatsapp       String?
  masterMemberId String?  @unique
  masterMember   MasterMember? @relation(fields: [masterMemberId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assignments BoardAssignment[]
}

model BoardAssignment {
  id                  String   @id @default(cuid())
  boardPeriodId       String
  boardPeriod         BoardPeriod       @relation(fields: [boardPeriodId], references: [id], onDelete: Cascade)
  managementMemberId  String
  managementMember    ManagementMember  @relation(fields: [managementMemberId], references: [id], onDelete: Cascade)
  boardRoleId         String
  boardRole           BoardRole         @relation(fields: [boardRoleId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([boardPeriodId, managementMemberId])
  @@unique([boardPeriodId, boardRoleId])
  @@index([managementMemberId])
  @@index([boardRoleId])
}
```

On `MasterMember` add:

```prisma
  managementMemberRecord ManagementMember?
```

On `Registration` add:

```prisma
  primaryManagementMemberId String?
  primaryManagementMember     ManagementMember? @relation(fields: [primaryManagementMemberId], references: [id], onDelete: SetNull)
  claimedManagementPublicCode String?
```

On `ManagementMember` add back-relation (single FK from `Registration` → no explicit `@relation` name needed unless Prisma reports ambiguity):

```prisma
  registrationsAsPrimary Registration[]
```

- [ ] **Step 2: Generate migration**

Run (from repo root, Node 24 per `AGENTS.md`):

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm prisma migrate dev --name board_management
```

Expected: migration SQL created; Prisma Client regenerates; no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add board management and registration primary management FK"
```

---

### Task 2: Pure helpers and unit tests (active period + recompute)

**Files:**

- Create: `src/lib/management/normalize-public-code.ts`
- Create: `src/lib/management/active-period.ts`
- Create: `src/lib/management/recompute-directory-flags.ts`
- Create: `src/lib/management/recompute-directory-flags.test.ts`

- [ ] **Step 1: Write failing test file**

Create `src/lib/management/recompute-directory-flags.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { findActiveBoardPeriod } from "@/lib/management/active-period";
import {
  computeIsManagementMemberForMember,
  type BoardAssignmentRow,
  type BoardPeriodRow,
} from "@/lib/management/recompute-directory-flags";

describe("findActiveBoardPeriod", () => {
  const periods: BoardPeriodRow[] = [
    {
      id: "p1",
      startsAt: new Date("2025-01-01T00:00:00.000Z"),
      endsAt: new Date("2025-12-31T00:00:00.000Z"),
    },
    {
      id: "p2",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
    },
  ];

  it("returns period where startsAt <= now < endsAt", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    expect(findActiveBoardPeriod(periods, now)?.id).toBe("p2");
  });

  it("returns null when none match", () => {
    const now = new Date("2027-06-15T12:00:00.000Z");
    expect(findActiveBoardPeriod(periods, now)).toBeNull();
  });
});

describe("computeIsManagementMemberForMember", () => {
  const activeId = "active";

  it("true when member linked and assigned in active period", () => {
    const assignments: BoardAssignmentRow[] = [
      {
        boardPeriodId: activeId,
        managementMemberId: "mm1",
        masterMemberId: "m1",
      },
    ];
    expect(
      computeIsManagementMemberForMember({
        masterMemberId: "m1",
        activePeriodId: activeId,
        assignments,
      }),
    ).toBe(true);
  });

  it("false when period inactive", () => {
    const assignments: BoardAssignmentRow[] = [
      {
        boardPeriodId: "other",
        managementMemberId: "mm1",
        masterMemberId: "m1",
      },
    ];
    expect(
      computeIsManagementMemberForMember({
        masterMemberId: "m1",
        activePeriodId: null,
        assignments,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/management/recompute-directory-flags.test.ts
```

Expected: FAIL (missing modules).

- [ ] **Step 3: Implement minimal modules**

`src/lib/management/normalize-public-code.ts`:

```typescript
/** Single rule: trim ASCII whitespace, uppercase A–Z for stable uniqueness. */
export function normalizePublicManagementCode(raw: string): string {
  return raw.trim().toUpperCase();
}
```

`src/lib/management/active-period.ts`:

```typescript
export type BoardPeriodRow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
};

/** Active iff startsAt <= now < endsAt (UTC instants). */
export function findActiveBoardPeriod(
  periods: BoardPeriodRow[],
  now: Date,
): BoardPeriodRow | null {
  return periods.find((p) => p.startsAt <= now && now < p.endsAt) ?? null;
}

export function periodsOverlap(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}
```

`src/lib/management/recompute-directory-flags.ts`:

```typescript
export type BoardAssignmentRow = {
  boardPeriodId: string;
  managementMemberId: string;
  /** Denormalized from `ManagementMember.masterMemberId` for the same `managementMemberId`. */
  masterMemberId: string | null;
};

export function computeIsManagementMemberForMember(input: {
  masterMemberId: string;
  activePeriodId: string | null;
  assignments: BoardAssignmentRow[];
}): boolean {
  if (!input.activePeriodId) return false;
  return input.assignments.some(
    (r) =>
      r.boardPeriodId === input.activePeriodId &&
      r.masterMemberId === input.masterMemberId,
  );
}
```

Implementers load joined rows in Task 6 so each assignment row includes `masterMemberId` from `ManagementMember`.

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm vitest run src/lib/management/recompute-directory-flags.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/management/
git commit -m "feat(management): add active period and directory flag helpers"
```

---

### Task 3: Audit action constants

**Files:**

- Modify: `src/lib/audit/club-audit-actions.ts`

- [ ] **Step 1: Extend `CLUB_AUDIT_ACTION`**

Add keys (exact strings):

```typescript
  BOARD_PERIOD_CREATED: "board_period.created",
  BOARD_PERIOD_UPDATED: "board_period.updated",
  BOARD_ROLE_CREATED: "board_role.created",
  BOARD_ROLE_UPDATED: "board_role.updated",
  BOARD_ROLE_DEACTIVATED: "board_role.deactivated",
  MANAGEMENT_MEMBER_CREATED: "management_member.created",
  MANAGEMENT_MEMBER_UPDATED: "management_member.updated",
  MANAGEMENT_MEMBER_PUBLIC_CODE_CHANGED: "management_member.public_code_changed",
  BOARD_ASSIGNMENT_CREATED: "board_assignment.created",
  BOARD_ASSIGNMENT_UPDATED: "board_assignment.updated",
  BOARD_ASSIGNMENT_REMOVED: "board_assignment.removed",
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/audit/club-audit-actions.ts
git commit -m "feat(audit): add board and management member actions"
```

---

### Task 4: Server actions — `BoardPeriod` (overlap validation)

**Files:**

- Create: `src/lib/forms/admin-board-period-schema.ts` (Zod: `label`, `startsAt`, `endsAt` as coerced `Date`)
- Create: `src/lib/actions/admin-board-periods.ts`

- [ ] **Step 1: Write failing test** — Create `src/lib/actions/admin-board-periods.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    boardPeriod: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/actions/guard", () => ({
  guardOwnerOrAdmin: vi.fn().mockResolvedValue({
    profileId: "actor_prof",
    role: "Owner",
    helperEventIds: [],
    authUserId: "actor_user",
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/audit/append-club-audit-log", () => ({
  appendClubAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { createBoardPeriod } from "@/lib/actions/admin-board-periods";

describe("createBoardPeriod", () => {
  beforeEach(() => {
    vi.mocked(prisma.boardPeriod.findMany).mockReset();
    vi.mocked(prisma.boardPeriod.create).mockReset();
  });

  it("rejects overlapping period", async () => {
    vi.mocked(prisma.boardPeriod.findMany).mockResolvedValue([
      {
        id: "existing",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T00:00:00.000Z"),
      },
    ] as never);

    const fd = new FormData();
    fd.set("label", "Kabinet B");
    fd.set("startsAt", "2026-06-01T00:00:00.000Z");
    fd.set("endsAt", "2027-06-01T00:00:00.000Z");

    const res = await createBoardPeriod(null, fd);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected fail");
    expect(String(res.rootError)).toMatch(/bertabrakan/i);
  });
});
```

Adjust import path to match exported function name you implement.

- [ ] **Step 2: Run test — FAIL** (`pnpm vitest run src/lib/actions/admin-board-periods.test.ts`)

- [ ] **Step 3: Implement** `createBoardPeriod` / `updateBoardPeriod` using `periodsOverlap` from `active-period.ts`; load all periods (or only overlapping candidates) in action; return `rootError("Rentang periode bertabrakan dengan periode lain.")` on overlap; on success `appendClubAuditLog` with `{ boardPeriodId, label }` metadata; `revalidatePath("/admin/management")`.

- [ ] **Step 4: Run test — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/forms/admin-board-period-schema.ts src/lib/actions/admin-board-periods.ts src/lib/actions/admin-board-periods.test.ts
git commit -m "feat(admin): board period CRUD with overlap validation"
```

---

### Task 5: Server actions — `BoardRole` and `ManagementMember`

**Files:**

- Create: `src/lib/forms/admin-board-role-schema.ts`
- Create: `src/lib/forms/admin-management-member-schema.ts`
- Create: `src/lib/actions/admin-board-roles.ts`
- Create: `src/lib/actions/admin-management-members.ts`

Implement using same guard/audit/revalidate pattern as Task 4. **`publicCode`** must pass through **`normalizePublicManagementCode`** before save; catch Prisma `P2002` on `publicCode` and return `rootError("Kode publik sudah dipakai.")`.

**`masterMemberId` uniqueness:** enforce `ManagementMember.masterMemberId` `@unique` — on conflict return Indonesian error.

- [ ] **Step 1: Commit server actions** (with at least one mocked test per file for the unhappy path you care about most, e.g. duplicate `publicCode`).

---

### Task 6: Server actions — `BoardAssignment` + transactional recompute

**Files:**

- Create: `src/lib/actions/admin-board-assignments.ts`
- Modify: `src/lib/management/recompute-directory-flags.ts` — add **`async function recomputeDirectoryManagementFlagsTx`** (`tx: Prisma.TransactionClient`, `seedMasterMemberIds: string[]`) that:
  1. Loads `findActiveBoardPeriod` data via `tx.boardPeriod.findMany`
  2. Builds assignment rows joined through `ManagementMember` for `masterMemberId`
  3. For each id in `seedMasterMemberIds`, computes boolean and `tx.masterMember.updateMany` / per-row `update`

Call **`recomputeDirectoryManagementFlagsTx`** at end of create/update/delete assignment and after period dates change (Task 4 update must pass union of affected master ids from old/new assignments). Use **`$transaction`** for assignment mutations.

- [ ] **Step 1: Integration-style unit test** with mocked `tx` objects is acceptable; alternatively test `recomputeDirectoryManagementFlagsTx` with full prisma mock like `admin-master-members.test.ts`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(admin): board assignments and directory flag recompute"
```

---

### Task 7: Remove manual `isManagementMember` from directory admin

**Files:**

- Modify: `src/lib/forms/admin-master-member-schema.ts`
- Modify: `src/components/admin/member-form-dialog.tsx`
- Modify: `src/lib/actions/admin-master-members.ts` (create/update omit `isManagementMember` from Prisma data)
- Modify: `src/lib/members/prepare-master-member-csv-row.ts` (ignore `is_management_member` / `isManagementMember` columns — no write)
- Modify: `src/lib/members/master-member-csv-prisma-data.ts` if it maps that field

- [ ] **Step 1: Update test** `src/lib/members/build-master-members-export-csv.test.ts` if expectations reference manual edits (export column can remain for read-only reporting).

- [ ] **Step 2: Run** `pnpm test` — all pass.

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(members): derive isManagementMember from kepengurusan only"
```

---

### Task 8: Navigation and route shell

**Files:**

- Modify: `src/lib/admin/global-nav-flags.ts` — add `management: ctx !== null && hasOperationalOwnerParity(ctx.role)`
- Modify: `src/components/admin/admin-app-shell.tsx` — link “Kepengurusan” when `navFlags.management`, `pathname.startsWith("/admin/management")`, icon e.g. `UsersRound` from `lucide-react`
- Find layout that passes `navFlags` (likely `src/app/admin/layout.tsx` or similar) and ensure `deriveGlobalSidebarNav` includes new flag.

- [ ] **Step 1: Create** `src/app/admin/management/page.tsx` — same auth gate as `src/app/admin/members/page.tsx` (`hasOperationalOwnerParity`); `notFound()` if unauthorized.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(admin): add kepengurusan nav and management route"
```

---

### Task 9: Management UI (minimal shippable)

**Files:**

- Create: `src/components/admin/management-admin-page.tsx` — table of periods + “Tambah periode” dialog (reuse `@base-ui/react` Dialog pattern from `CLAUDE.md`)
- Create: `src/app/admin/management/[periodId]/page.tsx` — roster: columns Jabatan (`BoardRole.title`), Nama (`ManagementMember.fullName`), Kode (`publicCode`), link ke anggota if `masterMemberId`
- Wire forms to server actions from Tasks 4–6.

Keep Indonesian copy consistent with existing admin.

- [ ] **Step 1: Commit**

```bash
git commit -m "feat(admin): kepengurusan periods and roster UI"
```

---

### Task 10: Public registration — schema and submit

**Files:**

- Modify: `src/lib/forms/submit-registration-schema.ts`
- Modify: `src/lib/actions/submit-registration.ts`
- Modify: `src/components/public/registration-form/*` as needed to post `managementPublicCode`

**Rules:**

1. If `purchaserIsMember && claimedMemberNumber` — existing directory flow.
2. If `purchaserIsMember && !claimedMemberNumber && managementPublicCode` — resolve `ManagementMember` by normalized code; require active period + `BoardAssignment` for that member; set `primaryManagementMemberId`, `claimedManagementPublicCode`, primary ticket `member` price per existing rules; **`includePartner`** allowed when this resolution yields management eligibility (same as `isManagementMember === true`).
3. Mutual exclusion: Zod `superRefine` error if both member number and code set.

Partner gate snippet concept (server):

```typescript
const primaryEligible =
  Boolean(primaryDirectoryRow?.isManagementMember) ||
  Boolean(resolvedManagementMemberId /* active assignment */);

if (includePartner && !primaryEligible) {
  return rootError(
    "Tiket partner hanya untuk pengurus (komite) — validasi identitas utama.",
  );
}
```

- [ ] **Step 1: Add resolver** `src/lib/management/resolve-management-member-for-registration.ts` exporting async function used by `submit-registration`.

- [ ] **Step 2: Run** `pnpm vitest run src/lib/pricing/compute-submit-total.test.ts` and full `pnpm test`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(registration): primary pengurus via public code"
```

---

### Task 11: Admin registration detail — jalur pengurus

**Files:**

- Modify: `src/lib/registrations/admin-ticket-context.ts` — extend `TicketContextManagementMemberVm` with:
  - `{ state: "via_directory"; isManagementMember: boolean }`
  - `{ state: "via_public_code"; publicCode: string; managementMemberFullName: string }`
  - keep `no_primary_number` / `not_in_directory` where applicable
- Modify: `src/lib/registrations/load-admin-ticket-context.ts` — if `registration.primaryManagementMemberId`, load `ManagementMember` and branch VM
- Modify: `src/components/admin/registration-detail.tsx` — short badge: “Direktori” vs “Kode pengurus”

- [ ] **Step 1: Commit**

```bash
git commit -m "feat(admin): show pengurus path on registration detail"
```

---

### Task 12: Seed (optional demo data)

**Files:**

- Modify: `prisma/seed.ts`

Add one `BoardPeriod` spanning current year UTC, one `BoardRole`, one `ManagementMember` with `publicCode` **`DEMO`**, `BoardAssignment`, and ensure linked `MasterMember` gets **`isManagementMember` true** after running recompute (or set consistent with assignment for dev UX).

- [ ] **Step 1: Commit**

```bash
git commit -m "chore(seed): demo board period and management member"
```

---

## Plan self-review

**1. Spec coverage:** §4 models (Task 1); §5 sync (Tasks 2, 6, 7); §6 public + admin (Tasks 10–11); §7 audit (Tasks 3–6); §8 UI (Tasks 8–9); §9 tests (Tasks 2, 4+). **2. Placeholder scan:** No `TBD` / vague validation steps; overlap error text is explicit Indonesian. **3. Type consistency:** `ManagementMember`, `BoardAssignment`, `Registration.primaryManagementMemberId` naming aligned across tasks; VM states named consistently for Task 11.

**Gap note:** `TicketPriceType.privilege_partner_member_price` remains unchanged; partner pricing still flows through `computeSubmitTotal` — only eligibility inputs widen.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-02-kepengurusan-management-member.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
