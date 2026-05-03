# Schema Rewire — AdminProfile → ManagementMember + EventPicHelper → AdminProfile

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewire `AdminProfile` to link directly to `ManagementMember` (remove old `MasterMember` link) and change `EventPicHelper` from `Event ↔ MasterMember` to `Event ↔ AdminProfile`, including all dependent code.

**Architecture:** One Prisma schema migration with embedded data migration SQL handles all DDL + data changes in the correct order. Application code is then updated file-by-file to use the new relations. The helper field in events is renamed from `helperMasterMemberIds` to `helperAdminProfileIds` throughout.

**Tech Stack:** Next.js App Router, Prisma ORM, Zod, react-hook-form, PostgreSQL (Neon)

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify — 4 model changes |
| `prisma/migrations/<ts>_schema_rewire_admin_management/migration.sql` | Create — DDL + data migration |
| `src/lib/auth/admin-context.ts` | Modify — simplify helper path |
| `src/lib/admin/pic-options-for-event.ts` | Modify — use managementMember, remove `loadPicAdminToMemberLinkMap` |
| `src/lib/admin/load-committee-admin-directory.ts` | Modify — memberId → managementMemberId |
| `src/lib/forms/committee-admin-profiles-schema.ts` | Modify — memberId → managementMemberId |
| `src/lib/actions/admin-committee-profiles.ts` | Modify — member link action |
| `src/components/admin/committee-admin-settings-panel.tsx` | Modify — picker UI |
| `src/lib/forms/admin-event-form-schema.ts` | Modify — rename helper field |
| `src/lib/actions/admin-events.ts` | Modify — simplify helper logic |
| `src/components/admin/forms/event-admin-form.tsx` | Modify — field rename + remove picMemberLinkByAdminId |
| `src/app/admin/events/new/page.tsx` | Modify — load AdminProfiles for helpers |
| `src/app/admin/events/[eventId]/edit/page.tsx` | Modify — load AdminProfiles for helpers |
| `src/app/admin/events/page.tsx` | Modify — PIC name from managementMember |

---

## Task 1: Schema changes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update `prisma/schema.prisma`**

Apply the following 4 changes to the schema:

**1a — `MasterMember`: remove `eventsAsHelper` back-relation**

Find the `MasterMember` model and remove the line:
```prisma
eventsAsHelper EventPicHelper[]
```

**1b — `AdminProfile`: replace `memberId` with `managementMemberId`**

In the `AdminProfile` model, replace:
```prisma
  memberId String?
  member   MasterMember? @relation(fields: [memberId], references: [id], onDelete: SetNull)
```
with:
```prisma
  managementMemberId String?           @unique
  managementMember   ManagementMember? @relation(fields: [managementMemberId], references: [id], onDelete: SetNull)
  eventsAsHelper     EventPicHelper[]
```

Also remove the old index `@@index([memberId])` and add:
```prisma
  @@index([managementMemberId])
```

**1c — `ManagementMember`: add back-relation**

In the `ManagementMember` model, add after the existing `assignments` line:
```prisma
  adminProfile AdminProfile?
```

**1d — `EventPicHelper`: replace `memberId` with `adminProfileId`**

Replace the entire model:
```prisma
model EventPicHelper {
  eventId        String
  adminProfileId String

  event        Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  adminProfile AdminProfile @relation(fields: [adminProfileId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@id([eventId, adminProfileId])
  @@index([adminProfileId])
}
```

- [ ] **Step 2: Generate migration with `--create-only`**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm prisma migrate dev --create-only --name schema_rewire_admin_management
```

Note the generated migration directory path — it will be something like `prisma/migrations/20260503XXXXXX_schema_rewire_admin_management/`.

- [ ] **Step 3: Replace the generated `migration.sql` entirely**

Open the generated `migration.sql` and replace its contents with the following (which preserves all DDL intent but adds data migration in the correct order):

```sql
-- Step 1: Add managementMemberId to AdminProfile (nullable for data migration)
ALTER TABLE "AdminProfile" ADD COLUMN "managementMemberId" TEXT;
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_managementMemberId_fkey"
  FOREIGN KEY ("managementMemberId") REFERENCES "ManagementMember"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "AdminProfile_managementMemberId_key" ON "AdminProfile"("managementMemberId");
CREATE INDEX "AdminProfile_managementMemberId_idx" ON "AdminProfile"("managementMemberId");

-- Step 2: Data-migrate AdminProfile.memberId → managementMemberId
-- For each AdminProfile whose memberId links to a MasterMember that has a ManagementMember record,
-- set managementMemberId to that ManagementMember's id.
UPDATE "AdminProfile" ap
SET "managementMemberId" = mm.id
FROM "ManagementMember" mm
WHERE ap."memberId" = mm."masterMemberId"
  AND mm."masterMemberId" IS NOT NULL;

-- Step 3: Add adminProfileId to EventPicHelper (nullable for data migration)
ALTER TABLE "EventPicHelper" ADD COLUMN "adminProfileId" TEXT;
ALTER TABLE "EventPicHelper" ADD CONSTRAINT "EventPicHelper_adminProfileId_fkey"
  FOREIGN KEY ("adminProfileId") REFERENCES "AdminProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Data-migrate EventPicHelper.memberId → adminProfileId
-- Use AdminProfile.memberId BEFORE it is dropped.
UPDATE "EventPicHelper" eph
SET "adminProfileId" = ap.id
FROM "AdminProfile" ap
WHERE ap."memberId" = eph."memberId"
  AND ap."memberId" IS NOT NULL;

-- Step 5: Delete orphan EventPicHelper rows (no matching AdminProfile)
DELETE FROM "EventPicHelper" WHERE "adminProfileId" IS NULL;

-- Step 6: Make adminProfileId NOT NULL
ALTER TABLE "EventPicHelper" ALTER COLUMN "adminProfileId" SET NOT NULL;

-- Step 7: Drop old EventPicHelper primary key and add new one
ALTER TABLE "EventPicHelper" DROP CONSTRAINT "EventPicHelper_pkey";
ALTER TABLE "EventPicHelper" ADD PRIMARY KEY ("eventId", "adminProfileId");

-- Step 8: Add new index, drop old one
CREATE INDEX "EventPicHelper_adminProfileId_idx" ON "EventPicHelper"("adminProfileId");
DROP INDEX IF EXISTS "EventPicHelper_memberId_idx";

-- Step 9: Drop EventPicHelper.memberId column
ALTER TABLE "EventPicHelper" DROP COLUMN "memberId";

-- Step 10: Drop AdminProfile.memberId column and its index
DROP INDEX IF EXISTS "AdminProfile_memberId_idx";
ALTER TABLE "AdminProfile" DROP COLUMN "memberId";
```

- [ ] **Step 4: Apply the migration**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm prisma migrate dev
```

Expected: `The following migration(s) have been applied: .../schema_rewire_admin_management`

- [ ] **Step 5: Regenerate Prisma client**

```bash
pnpm prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): rewire AdminProfile to ManagementMember, EventPicHelper to AdminProfile"
```

---

## Task 2: Update `getAdminContext`

**Files:**
- Modify: `src/lib/auth/admin-context.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import { prisma } from "@/lib/db/prisma";
import type { AdminContext } from "@/lib/permissions/guards";
import type { AdminRole } from "@/lib/permissions/roles";

export async function getAdminContext(
  authUserId: string,
): Promise<AdminContext | null> {
  const profile = await prisma.adminProfile.findUnique({
    where: { authUserId },
    include: {
      eventsAsHelper: { select: { eventId: true } },
    },
  });
  if (!profile) return null;

  const helperEventIds = profile.eventsAsHelper.map((e) => e.eventId);

  return {
    profileId: profile.id,
    role: profile.role as AdminRole,
    helperEventIds,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "admin-context" || echo "No errors in admin-context"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/admin-context.ts
git commit -m "refactor(auth): simplify getAdminContext — eventsAsHelper now on AdminProfile directly"
```

---

## Task 3: Update `pic-options-for-event.ts`

**Files:**
- Modify: `src/lib/admin/pic-options-for-event.ts`

- [ ] **Step 1: Replace the file contents**

`loadPicAdminToMemberLinkMap` is removed — helper exclusion is now by adminProfileId directly (handled in downstream callers). `loadPicAdminProfileOptionsForEvents` label now uses `managementMember.publicCode`.

```typescript
import { AdminRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type PicAdminOption = { id: string; label: string };

/** Daftar admin yang boleh dipilih sebagai PIC utama atau helper acara (bukan Viewer). */
export async function loadPicAdminProfileOptionsForEvents(): Promise<
  PicAdminOption[]
> {
  const profiles = await prisma.adminProfile.findMany({
    where: { role: { not: AdminRole.Viewer } },
    select: {
      id: true,
      authUserId: true,
      managementMember: { select: { publicCode: true } },
    },
  });
  if (profiles.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: profiles.map((p) => p.authUserId) } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const options: PicAdminOption[] = profiles.map((p) => {
    const u = userById.get(p.authUserId);
    const base =
      u?.name?.trim() || u?.email?.trim() || `admin:${p.id.slice(0, 8)}`;
    const suffix = p.managementMember?.publicCode
      ? ` · ${p.managementMember.publicCode}`
      : "";
    return { id: p.id, label: `${base}${suffix}` };
  });

  options.sort((a, b) => a.label.localeCompare(b.label, "id"));
  return options;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "pic-options" || echo "No errors in pic-options-for-event"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/pic-options-for-event.ts
git commit -m "refactor(admin): pic-options — use managementMember.publicCode, remove member link map"
```

---

## Task 4: Update `load-committee-admin-directory.ts`

**Files:**
- Modify: `src/lib/admin/load-committee-admin-directory.ts`

- [ ] **Step 1: Replace the file contents**

`memberOptions` now comes from `ManagementMember` (not `MasterMember`). The label uses `publicCode — fullName`.

```typescript
import { prisma } from "@/lib/db/prisma";

export type CommitteeAdminDirectoryRowVm = {
  adminProfileId: string;
  authUserId: string;
  email: string;
  displayName: string;
  role: string;
  managementMemberId: string | null;
  memberSummary: string | null;
  twoFactorEnabled: boolean;
  lastSessionActivityAtIso: string | null;
};

export type CommitteeAdminDirectoryVm = {
  rows: CommitteeAdminDirectoryRowVm[];
  memberOptions: { id: string; label: string }[];
};

export async function loadCommitteeAdminDirectory(): Promise<CommitteeAdminDirectoryVm> {
  const now = new Date();

  const [profiles, memberOptionsRaw] = await Promise.all([
    prisma.adminProfile.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        authUserId: true,
        role: true,
        managementMemberId: true,
        managementMember: {
          select: { publicCode: true, fullName: true },
        },
      },
    }),
    prisma.managementMember.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, publicCode: true, fullName: true },
    }),
  ]);

  const userIds = profiles.map((p) => p.authUserId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      name: true,
      twoFactorEnabled: true,
    },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const sessions = await prisma.session.findMany({
    where: {
      userId: { in: userIds },
      expiresAt: { gt: now },
    },
    select: { userId: true, updatedAt: true },
  });

  const lastSessionByUser = new Map<string, Date>();
  for (const s of sessions) {
    const prev = lastSessionByUser.get(s.userId);
    if (!prev || s.updatedAt > prev) {
      lastSessionByUser.set(s.userId, s.updatedAt);
    }
  }

  const rows: CommitteeAdminDirectoryRowVm[] = profiles.map((p) => {
    const u = userById.get(p.authUserId);
    const last = lastSessionByUser.get(p.authUserId);
    return {
      adminProfileId: p.id,
      authUserId: p.authUserId,
      email: u?.email ?? p.authUserId,
      displayName: u?.name ?? "—",
      role: p.role,
      managementMemberId: p.managementMemberId,
      memberSummary: p.managementMember
        ? `${p.managementMember.publicCode} — ${p.managementMember.fullName}`
        : null,
      twoFactorEnabled: Boolean(u?.twoFactorEnabled),
      lastSessionActivityAtIso: last ? last.toISOString() : null,
    };
  });

  const memberOptions = memberOptionsRaw.map((m) => ({
    id: m.id,
    label: `${m.publicCode} — ${m.fullName}`,
  }));

  return { rows, memberOptions };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "load-committee" || echo "No errors in load-committee-admin-directory"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/load-committee-admin-directory.ts
git commit -m "refactor(admin): committee directory — use managementMember instead of masterMember"
```

---

## Task 5: Update committee admin profiles schema + action

**Files:**
- Modify: `src/lib/forms/committee-admin-profiles-schema.ts`
- Modify: `src/lib/actions/admin-committee-profiles.ts`

- [ ] **Step 1: Update `committee-admin-profiles-schema.ts`**

Replace `memberId` with `managementMemberId` in `updateCommitteeAdminMemberLinkSchema`:

```typescript
export const updateCommitteeAdminMemberLinkSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
  managementMemberId: z
    .string()
    .optional()
    .transform((s) => (s == null ? null : (s.trim() === "" ? null : s.trim()))),
});
```

All other schemas in the file stay the same.

- [ ] **Step 2: Update `admin-committee-profiles.ts` — `updateCommitteeAdminMemberLink`**

Replace the `updateCommitteeAdminMemberLink` function (lines ~160–218):

```typescript
export async function updateCommitteeAdminMemberLink(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = updateCommitteeAdminMemberLinkSchema.safeParse({
    adminProfileId: formData.get("adminProfileId"),
    managementMemberId: formData.get("managementMemberId") ?? "",
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const target = await prisma.adminProfile.findUnique({
    where: { id: parsed.data.adminProfileId },
    select: { id: true, authUserId: true, managementMemberId: true },
  });
  if (!target) return rootError("Profil admin tidak ditemukan.");

  let nextManagementMemberId: string | null = parsed.data.managementMemberId;
  if (nextManagementMemberId) {
    const member = await prisma.managementMember.findUnique({
      where: { id: nextManagementMemberId },
      select: { id: true },
    });
    if (!member) return rootError("Pengurus yang dipilih tidak ditemukan.");
  } else {
    nextManagementMemberId = null;
  }

  const prevManagementMemberId = target.managementMemberId;

  try {
    await prisma.adminProfile.update({
      where: { id: target.id },
      data: { managementMemberId: nextManagementMemberId },
    });
  } catch (e) {
    // P2002 = unique constraint: another admin already linked to this ManagementMember
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return rootError("Pengurus ini sudah dikaitkan ke akun admin lain.");
    }
    throw e;
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_MEMBER_LINK_CHANGED,
    targetType: "admin_profile",
    targetId: target.id,
    metadata: {
      targetAuthUserId: target.authUserId,
      prevManagementMemberId,
      nextManagementMemberId,
    },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ saved: true });
}
```

Also add `import { Prisma } from "@prisma/client";` at the top if not already present.

- [ ] **Step 3: Update `revokeCommitteeAdminMeaningfulAccess` in the same file**

Find the `prisma.adminProfile.update` call inside `revokeCommitteeAdminMeaningfulAccess` and change:
```typescript
    data: {
      role: AdminRole.Viewer,
      memberId: null,
    },
```
to:
```typescript
    data: {
      role: AdminRole.Viewer,
      managementMemberId: null,
    },
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "committee-admin" || echo "No errors in committee-admin files"
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/forms/committee-admin-profiles-schema.ts src/lib/actions/admin-committee-profiles.ts
git commit -m "refactor(admin): committee member link — memberId → managementMemberId"
```

---

## Task 6: Update `committee-admin-settings-panel.tsx`

**Files:**
- Modify: `src/components/admin/committee-admin-settings-panel.tsx`

- [ ] **Step 1: Update prop type and form field**

Find the `CommitteeAdminDirectoryRowVm` import — it now has `managementMemberId` instead of `memberId`. The component consumes `row.memberId` and `props.memberOptions`. Update all references:

Replace `row.memberId` with `row.managementMemberId` (all occurrences in the component).

Replace the select element's `name` attribute and `defaultValue`:

```tsx
<select
  id={`member-${row.adminProfileId}`}
  name="managementMemberId"
  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
  defaultValue={row.managementMemberId ?? ""}
  disabled={memberPending}
>
  <option value="">— Tidak dikaitkan</option>
  {props.memberOptions.map((opt) => (
    <option key={opt.id} value={opt.id}>
      {opt.label}
    </option>
  ))}
</select>
```

The label text ("Anggota") can be updated to "Pengurus" for clarity:

```tsx
<Label htmlFor={`member-${row.adminProfileId}`}>Pengurus</Label>
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "committee-admin-settings" || echo "No errors in committee-admin-settings-panel"
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/committee-admin-settings-panel.tsx
git commit -m "refactor(ui): committee settings — link to ManagementMember instead of MasterMember"
```

---

## Task 7: Update event form schema

**Files:**
- Modify: `src/lib/forms/admin-event-form-schema.ts`

- [ ] **Step 1: Rename `helperMasterMemberIds` to `helperAdminProfileIds`**

In `adminEventUpsertSchema`, replace:
```typescript
    helperMasterMemberIds: z.array(z.string().min(1)),
```
with:
```typescript
    helperAdminProfileIds: z.array(z.string().min(1)),
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "admin-event-form-schema" || echo "No errors in admin-event-form-schema"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/forms/admin-event-form-schema.ts
git commit -m "refactor(schema): rename helperMasterMemberIds to helperAdminProfileIds"
```

---

## Task 8: Update `admin-events.ts`

**Files:**
- Modify: `src/lib/actions/admin-events.ts`

- [ ] **Step 1: Replace `validatePicBankAndHelpers`**

Replace the entire function (lines ~78–125):

```typescript
async function validatePicBankAndHelpers(opts: Pick<
  AdminEventUpsertInput,
  "picAdminProfileId" | "bankAccountId" | "helperAdminProfileIds"
>): Promise<ActionResult<void>> {
  const pic = await prisma.adminProfile.findUnique({
    where: { id: opts.picAdminProfileId },
    select: { id: true, role: true },
  });

  if (!pic || pic.role === AdminRole.Viewer) {
    return fieldError({
      picAdminProfileId: "PIC tidak valid atau tidak boleh menjadi PIC.",
    });
  }

  const bank = await prisma.picBankAccount.findFirst({
    where: {
      id: opts.bankAccountId,
      ownerAdminProfileId: opts.picAdminProfileId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!bank) {
    return fieldError({
      bankAccountId: "Rekening tidak milik PIC atau tidak aktif.",
    });
  }

  // Exclude PIC from helpers before validation
  const helperIds = [...new Set(opts.helperAdminProfileIds)].filter(
    (id) => id !== opts.picAdminProfileId,
  );

  if (helperIds.length > 0) {
    const rows = await prisma.adminProfile.findMany({
      where: { id: { in: helperIds } },
      select: { id: true },
    });
    if (rows.length !== helperIds.length) {
      return fieldError({
        helperAdminProfileIds: "Salah satu PIC helper tidak ditemukan.",
      });
    }
  }

  return ok(undefined);
}
```

- [ ] **Step 2: Remove `uniqueHelperMemberIdsExcludingPicLinkedMember`**

Delete the entire function (lines ~127–134).

- [ ] **Step 3: Update `createAdminEvent`**

**3a** — Remove the `picForHelpers` fetch (lines ~169–172):
```typescript
// DELETE these lines:
const picForHelpers = await prisma.adminProfile.findUnique({
  where: { id: data.picAdminProfileId },
  select: { memberId: true },
});
```

**3b** — Replace the `helperIds` computation (lines ~180–183):
```typescript
// REPLACE:
const helperIds = uniqueHelperMemberIdsExcludingPicLinkedMember(
  data.helperMasterMemberIds,
  picForHelpers?.memberId ?? null,
);
// WITH:
const helperIds = [...new Set(data.helperAdminProfileIds)].filter(
  (id) => id !== data.picAdminProfileId,
);
```

**3c** — Update the `validatePicBankAndHelpers` call (lines ~162–167):
```typescript
const vPic = await validatePicBankAndHelpers({
  picAdminProfileId: data.picAdminProfileId,
  bankAccountId: data.bankAccountId,
  helperAdminProfileIds: data.helperAdminProfileIds,
});
```

**3d** — Update the `createMany` in the transaction (line ~249):
```typescript
data: helperIds.map((adminProfileId) => ({ eventId: id, adminProfileId })),
```

- [ ] **Step 4: Update `updateAdminEvent`**

**4a** — Update `helpers` select in initial event fetch (line ~306):
```typescript
helpers: { select: { adminProfileId: true } },
```

**4b** — Update the `validatePicBankAndHelpers` call (lines ~364–368):
```typescript
const vPic = await validatePicBankAndHelpers({
  picAdminProfileId: data.picAdminProfileId,
  bankAccountId: data.bankAccountId,
  helperAdminProfileIds: data.helperAdminProfileIds,
});
```

**4c** — Remove `picForHelpersUpdate` fetch and old `helperIds` computation (lines ~371–378):
```typescript
// DELETE:
const picForHelpersUpdate = await prisma.adminProfile.findUnique({
  where: { id: data.picAdminProfileId },
  select: { memberId: true },
});
const helperIds = uniqueHelperMemberIdsExcludingPicLinkedMember(
  data.helperMasterMemberIds,
  picForHelpersUpdate?.memberId ?? null,
);
// ADD:
const helperIds = [...new Set(data.helperAdminProfileIds)].filter(
  (id) => id !== data.picAdminProfileId,
);
```

**4d** — Update the `createMany` in the transaction (line ~456):
```typescript
data: helperIds.map((adminProfileId) => ({ eventId, adminProfileId })),
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "admin-events" || echo "No errors in admin-events"
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/admin-events.ts
git commit -m "refactor(actions): admin-events — helperAdminProfileIds, remove member link map usage"
```

---

## Task 9: Update `event-admin-form.tsx`

**Files:**
- Modify: `src/components/admin/forms/event-admin-form.tsx`

- [ ] **Step 1: Remove `picMemberLinkByAdminId` prop**

In `EventAdminFormProps`, remove:
```typescript
  /** Optional directory member id per PIC admin (for disabling duplicate helper). */
  picMemberLinkByAdminId: Record<string, string | null>;
```

- [ ] **Step 2: Rename field in `useFieldArray` / form default**

Find `name: "helperMasterMemberIds"` in the `useFieldArray` call and change to `"helperAdminProfileIds"`.

- [ ] **Step 3: Update helper checkbox logic**

Find the helper list render block. The current code checks `picMemberLinkByAdminId` to disable helpers. Replace with a direct `picAdminProfileId` check.

The helper is disabled if its `id` equals the currently selected PIC's `picAdminProfileId`:

```tsx
{props.helperAdminOptions.map((p) => {
  const selectedPicId = form.watch("picAdminProfileId");
  const currentHelpers: string[] =
    form.getValues("helperAdminProfileIds") ?? [];
  const checked = currentHelpers.includes(p.id);
  const disabledAsPic = p.id === selectedPicId;
  return (
    <label
      key={p.id}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
        checked && "border-primary/40 bg-primary/5",
        disabledAsPic && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        className="accent-primary"
        checked={checked}
        disabled={disabledAsPic || isPending}
        onChange={(e) => {
          const prev: string[] =
            form.getValues("helperAdminProfileIds") ?? [];
          if (e.target.checked) {
            form.setValue("helperAdminProfileIds", [...prev, p.id]);
          } else {
            form.setValue(
              "helperAdminProfileIds",
              prev.filter((id) => id !== p.id),
            );
          }
        }}
      />
      {p.label}
    </label>
  );
})}
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "event-admin-form" || echo "No errors in event-admin-form"
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/forms/event-admin-form.tsx
git commit -m "refactor(ui): event form — helperAdminProfileIds, remove picMemberLinkByAdminId"
```

---

## Task 10: Update event new + edit pages

**Files:**
- Modify: `src/app/admin/events/new/page.tsx`
- Modify: `src/app/admin/events/[eventId]/edit/page.tsx`

- [ ] **Step 1: Update `events/new/page.tsx`**

Remove the `loadPicAdminToMemberLinkMap` import and call. Remove the `prisma.masterMember.findMany` query for helpers. Replace with reuse of `picOptions` as `helperAdminOptions`:

```typescript
// Remove this import:
// import { loadPicAdminToMemberLinkMap } from "@/lib/admin/pic-options-for-event";

// The parallel fetch changes from 4 items to 2:
const [picOptions, banks] = await Promise.all([
  loadPicAdminProfileOptionsForEvents(),
  prisma.picBankAccount.findMany({
    where: { isActive: true },
    orderBy: { bankName: "asc" },
    select: {
      id: true,
      ownerAdminProfileId: true,
      bankName: true,
      accountNumber: true,
      accountName: true,
    },
  }),
]);

// helperAdminOptions = same list as picOptions (PIC excluded in form)
const helperAdminOptions = picOptions;
```

Update the defaults object:
```typescript
    helperAdminProfileIds: [],
```
(remove `helperMasterMemberIds: []`)

Update the `EventAdminForm` props — remove `picMemberLinkByAdminId={picMemberLinkByAdminId}`.

- [ ] **Step 2: Update `events/[eventId]/edit/page.tsx`**

Same removals. For the event initial data:
```typescript
// Change helpers select in event query:
helpers: { select: { adminProfileId: true } },

// And in defaults:
helperAdminProfileIds: event.helpers.map((h) => h.adminProfileId),
```

Remove `loadPicAdminToMemberLinkMap` and the `masterMember.findMany` query for helpers. Set `helperAdminOptions = picOptions`.

Remove `picMemberLinkByAdminId` from `EventAdminForm` props.

- [ ] **Step 3: Verify no TypeScript errors**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "events/" || echo "No errors in events pages"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/events/new/page.tsx src/app/admin/events/\[eventId\]/edit/page.tsx
git commit -m "refactor(pages): event pages — load AdminProfiles for helpers, remove member link map"
```

---

## Task 11: Update events list page — PIC name display

**Files:**
- Modify: `src/app/admin/events/page.tsx`

- [ ] **Step 1: Update Prisma select for `picAdminProfile`**

Find the events query and change the `picAdminProfile` select from:
```typescript
        picAdminProfile: {
          select: {
            authUserId: true,
            member: { select: { fullName: true } },
          },
        },
```
to:
```typescript
        picAdminProfile: {
          select: {
            authUserId: true,
            managementMember: { select: { fullName: true } },
          },
        },
```

- [ ] **Step 2: Update PIC name resolution**

Find the `picFullName` computation and change from:
```typescript
      event.picAdminProfile.member?.fullName?.trim() ||
```
to:
```typescript
      event.picAdminProfile.managementMember?.fullName?.trim() ||
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | grep "events/page" || echo "No errors in events/page"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/events/page.tsx
git commit -m "refactor(pages): events list — PIC name from managementMember"
```

---

## Task 12: Full build verification

- [ ] **Step 1: Run full TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit
```

Expected: no errors. If errors appear, fix them before continuing.

- [ ] **Step 2: Run tests**

```bash
pnpm test
```

Expected: all existing tests pass. The `permissions.test.ts` tests for `canVerifyEvent` should still pass since `AdminContext` shape is unchanged.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Final commit if any lint fixes were needed**

```bash
git add -p
git commit -m "fix(lint): address lint issues from schema rewire"
```
