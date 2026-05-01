# Komite & admin — pengelolaan in-app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membolehkan Owner mengelola `AdminProfile` dari `/admin/settings/committee`, menambah kolom transparansi 2FA dan aktivitas sesi terbaru, memperjelas copy/CTA hub Pengaturan, dengan audit konfigurasi dan invariant satu Owner tetap ada.

**Architecture:** Tetap satu RSC utama yang memuat data direktori (Prisma agregasi sesi aktif di memori untuk skala tim kecil) dan daftar opsi `MasterMember` untuk tautan opsional; mutasi bersifat server actions bertanda `"use server"` yang memanggil `guardOwner()`, mengembalikan `ActionResult`, menulis `ClubAuditLog` via `appendClubAuditLog`, dan `revalidatePath`. Aturan Owner terakhir diekstrak sebagai fungsi murni yang diuji Vitest tanpa DB.

**Tech Stack:** Next.js App Router · React `useActionState` · Prisma (PostgreSQL) · Vitest · Zod · Better Auth (`User`, `Session` di schema Prisma) · Base UI `Dialog`.

---

## File map

| Path | Responsibility |
|------|----------------|
| **Create** `src/lib/admin/committee-owner-invariants.ts` | Pure checks: boleh menurunkan Owner hanya jika masih ada Owner lain. |
| **Create** `src/lib/admin/committee-owner-invariants.test.ts` | Unit tests invariant. |
| **Modify** `src/lib/audit/club-audit-actions.ts` | Konstanta aksi audit baru untuk UI. |
| **Create** `src/lib/forms/committee-admin-profiles-schema.ts` | Zod schema `FormData` untuk empat operasi. |
| **Create** `src/lib/admin/load-committee-admin-directory.ts` | Loader RSC: profil admin, user, agregat `Session`, opsi anggota. |
| **Create** `src/lib/actions/admin-committee-profiles.ts` | Server actions: tambah oleh email, ubah peran, ubah tautan anggota, cabut akses bermakna. |
| **Create** `src/lib/actions/admin-committee-profiles.test.ts` | Vitest dengan mock prisma + guard untuk jalur utama. |
| **Create** `src/components/admin/committee-admin-settings-panel.tsx` | Client: tabel + dialog tambah/edit/revoke. |
| **Modify** `src/app/admin/settings/committee/page.tsx` | Menyusun loader + panel; copy blok B spek. |
| **Modify** `src/app/admin/settings/page.tsx` | Memperjelas kartu Komite & admin (hub). |

---

### Task 1: Invariant Owner (TDD)

**Files:**
- Create: `src/lib/admin/committee-owner-invariants.ts`
- Create: `src/lib/admin/committee-owner-invariants.test.ts`

- [ ] **Step 1: Write the failing tests**

Buat file `src/lib/admin/committee-owner-invariants.ts` dulu kosong eksport atau sengaja salah, atau langsung tulis tes yang mengimpor fungsi berikut:

```typescript
import { describe, expect, it } from "vitest";

import {
  roleChangePreservesAtLeastOneOwner,
} from "@/lib/admin/committee-owner-invariants";
import type { AdminRole } from "@prisma/client";

describe("roleChangePreservesAtLeastOneOwner", () => {
  it("allows demoting Owner when another Owner exists", () => {
    const owners = ["o1", "o2"];
    expect(
      roleChangePreservesAtLeastOneOwner({
        ownerAuthUserIds: owners,
        targetAuthUserId: "o1",
        previousRole: "Owner",
        nextRole: "Admin",
      }),
    ).toBe(true);
  });

  it("blocks demoting the only Owner", () => {
    const owners = ["o1"];
    expect(
      roleChangePreservesAtLeastOneOwner({
        ownerAuthUserIds: owners,
        targetAuthUserId: "o1",
        previousRole: "Owner",
        nextRole: "Admin",
      }),
    ).toBe(false);
  });

  it("allows non-Owner changing role freely when single Owner elsewhere", () => {
    expect(
      roleChangePreservesAtLeastOneOwner({
        ownerAuthUserIds: ["alice"],
        targetAuthUserId: "bob",
        previousRole: "Admin",
        nextRole: "Viewer",
      }),
    ).toBe(true);
  });

  it("allows promoting to Owner regardless of counts", () => {
    expect(
      roleChangePreservesAtLeastOneOwner({
        ownerAuthUserIds: ["alice"],
        targetAuthUserId: "bob",
        previousRole: "Admin",
        nextRole: "Owner",
      }),
    ).toBe(true);
  });

  it("allows Owner staying Owner", () => {
    expect(
      roleChangePreservesAtLeastOneOwner({
        ownerAuthUserIds: ["o1"],
        targetAuthUserId: "o1",
        previousRole: "Owner",
        nextRole: "Owner",
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run:

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/admin/committee-owner-invariants.test.ts
```

Expected: FAIL (`roleChangePreservesAtLeastOneOwner` is not exported or not defined).

- [ ] **Step 3: Implement minimal module**

Create `src/lib/admin/committee-owner-invariants.ts`:

```typescript
import type { AdminRole } from "@prisma/client";

export function roleChangePreservesAtLeastOneOwner(args: {
  ownerAuthUserIds: readonly string[];
  targetAuthUserId: string;
  previousRole: AdminRole;
  nextRole: AdminRole;
}): boolean {
  if (args.previousRole !== "Owner" || args.nextRole === "Owner") {
    return true;
  }
  const stillOwner = args.ownerAuthUserIds.filter(
    (id) => id !== args.targetAuthUserId,
  );
  return stillOwner.length > 0;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run the same `pnpm vitest run` command. Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/committee-owner-invariants.ts src/lib/admin/committee-owner-invariants.test.ts
git commit -m "feat(admin): pure helper for last-Owner safety on role changes"
```

---

### Task 2: Audit action constants

**Files:**
- Modify: `src/lib/audit/club-audit-actions.ts`

- [ ] **Step 1: Add three entries to `CLUB_AUDIT_ACTION`**

Append (keep trailing style consistent):

```typescript
  ADMIN_PROFILE_CREATED_UI: "admin_profile.created_ui",
  ADMIN_PROFILE_ROLE_CHANGED: "admin_profile.role_changed",
  ADMIN_PROFILE_MEMBER_LINK_CHANGED: "admin_profile.member_link_changed",
```

`ClubAuditAction` tetap terinfer dari object `as const`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/audit/club-audit-actions.ts
git commit -m "feat(audit): actions for committee admin profile UI"
```

---

### Task 3: Zod schemas for FormData

**Files:**
- Create: `src/lib/forms/committee-admin-profiles-schema.ts`

- [ ] **Step 1: Add schemas**

```typescript
import { z } from "zod";

import { AdminRole } from "@prisma/client";

const adminRoleEnum = z.enum([
  AdminRole.Owner,
  AdminRole.Admin,
  AdminRole.Verifier,
  AdminRole.Viewer,
]);

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

export const addCommitteeAdminByEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Format email tidak valid.")
    .transform((s) => s.toLowerCase()),
});

export const updateCommitteeAdminRoleSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
  role: adminRoleEnum,
});

export const updateCommitteeAdminMemberLinkSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
  memberId: z
    .string()
    .optional()
    .transform((s) => (s == null ? null : emptyToNull(s))),
});

export const revokeCommitteeAdminAccessSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/forms/committee-admin-profiles-schema.ts
git commit -m "feat(forms): zod schemas for committee admin profile actions"
```

---

### Task 4: Loader for directory + member options

**Files:**
- Create: `src/lib/admin/load-committee-admin-directory.ts`

- [ ] **Step 1: Implement loader**

```typescript
import { prisma } from "@/lib/db/prisma";

export type CommitteeAdminDirectoryRowVm = {
  adminProfileId: string;
  authUserId: string;
  email: string;
  displayName: string;
  role: string;
  memberId: string | null;
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
        memberId: true,
        member: {
          select: { memberNumber: true, fullName: true },
        },
      },
    }),
    prisma.masterMember.findMany({
      orderBy: { memberNumber: "asc" },
      select: { id: true, memberNumber: true, fullName: true },
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
      memberId: p.memberId,
      memberSummary: p.member
        ? `${p.member.memberNumber} — ${p.member.fullName}`
        : null,
      twoFactorEnabled: Boolean(u?.twoFactorEnabled),
      lastSessionActivityAtIso: last ? last.toISOString() : null,
    };
  });

  const memberOptions = memberOptionsRaw.map((m) => ({
    id: m.id,
    label: `${m.memberNumber} — ${m.fullName}`,
  }));

  return { rows, memberOptions };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin/load-committee-admin-directory.ts
git commit -m "feat(admin): load committee admin directory with 2FA and session hint"
```

---

### Task 5: Server actions (mutations)

**Files:**
- Create: `src/lib/actions/admin-committee-profiles.ts`

- [ ] **Step 1: Implement all four actions**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { roleChangePreservesAtLeastOneOwner } from "@/lib/admin/committee-owner-invariants";
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import {
  guardOwner,
  isAuthError,
  type OwnerGuardContext,
} from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import {
  addCommitteeAdminByEmailSchema,
  revokeCommitteeAdminAccessSchema,
  updateCommitteeAdminMemberLinkSchema,
  updateCommitteeAdminRoleSchema,
} from "@/lib/forms/committee-admin-profiles-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { AdminRole } from "@prisma/client";

async function requireOwner(): Promise<
  ActionResult<never> | { owner: OwnerGuardContext }
> {
  try {
    const owner = await guardOwner();
    return { owner };
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }
}

async function listOwnerAuthUserIds(): Promise<string[]> {
  const owners = await prisma.adminProfile.findMany({
    where: { role: AdminRole.Owner },
    select: { authUserId: true },
  });
  return owners.map((o) => o.authUserId);
}

export async function addCommitteeAdminByEmail(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ created: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = addCommitteeAdminByEmailSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: parsed.data.email, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (!user) {
    return rootError(
      "Tidak ada pengguna dengan email tersebut. Pengguna harus sudah punya akun masuk.",
    );
  }

  const existing = await prisma.adminProfile.findUnique({
    where: { authUserId: user.id },
    select: { id: true },
  });
  if (existing) {
    return rootError("Akun ini sudah terdaftar sebagai admin.");
  }

  const created = await prisma.adminProfile.create({
    data: {
      authUserId: user.id,
      role: AdminRole.Viewer,
    },
    select: { id: true },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_CREATED_UI,
    targetType: "admin_profile",
    targetId: created.id,
    metadata: { targetAuthUserId: user.id, email: parsed.data.email },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ created: true });
}

export async function updateCommitteeAdminRole(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = updateCommitteeAdminRoleSchema.safeParse({
    adminProfileId: formData.get("adminProfileId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const target = await prisma.adminProfile.findUnique({
    where: { id: parsed.data.adminProfileId },
    select: { id: true, authUserId: true, role: true },
  });
  if (!target) {
    return rootError("Profil admin tidak ditemukan.");
  }

  const ownerIds = await listOwnerAuthUserIds();
  if (
    !roleChangePreservesAtLeastOneOwner({
      ownerAuthUserIds: ownerIds,
      targetAuthUserId: target.authUserId,
      previousRole: target.role,
      nextRole: parsed.data.role,
    })
  ) {
    return rootError(
      "Minimal harus ada satu Owner. Tambahkan Owner lain sebelum mengubah peran ini.",
    );
  }

  await prisma.adminProfile.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_ROLE_CHANGED,
    targetType: "admin_profile",
    targetId: target.id,
    metadata: {
      targetAuthUserId: target.authUserId,
      fromRole: target.role,
      toRole: parsed.data.role,
    },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ saved: true });
}

export async function updateCommitteeAdminMemberLink(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = updateCommitteeAdminMemberLinkSchema.safeParse({
    adminProfileId: formData.get("adminProfileId"),
    memberId: formData.get("memberId") ?? "",
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const target = await prisma.adminProfile.findUnique({
    where: { id: parsed.data.adminProfileId },
    select: {
      id: true,
      authUserId: true,
      memberId: true,
    },
  });
  if (!target) {
    return rootError("Profil admin tidak ditemukan.");
  }

  let nextMemberId: string | null = parsed.data.memberId;
  if (nextMemberId) {
    const member = await prisma.masterMember.findUnique({
      where: { id: nextMemberId },
      select: { id: true },
    });
    if (!member) return rootError("Anggota yang dipilih tidak ditemukan.");
  } else {
    nextMemberId = null;
  }

  const prevMemberId = target.memberId;

  await prisma.adminProfile.update({
    where: { id: target.id },
    data: { memberId: nextMemberId },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_MEMBER_LINK_CHANGED,
    targetType: "admin_profile",
    targetId: target.id,
    metadata: {
      targetAuthUserId: target.authUserId,
      prevMemberId,
      nextMemberId,
    },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ saved: true });
}

export async function revokeCommitteeAdminMeaningfulAccess(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = revokeCommitteeAdminAccessSchema.safeParse({
    adminProfileId: formData.get("adminProfileId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const target = await prisma.adminProfile.findUnique({
    where: { id: parsed.data.adminProfileId },
    select: { id: true, authUserId: true, role: true },
  });
  if (!target) {
    return rootError("Profil admin tidak ditemukan.");
  }

  const ownerIds = await listOwnerAuthUserIds();
  if (
    !roleChangePreservesAtLeastOneOwner({
      ownerAuthUserIds: ownerIds,
      targetAuthUserId: target.authUserId,
      previousRole: target.role,
      nextRole: AdminRole.Viewer,
    })
  ) {
    return rootError(
      "Minimal harus ada satu Owner. Transfer kepemilikan sebelum mencabut akses Owner ini.",
    );
  }

  await prisma.adminProfile.update({
    where: { id: target.id },
    data: {
      role: AdminRole.Viewer,
      memberId: null,
    },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_ROLE_CHANGED,
    targetType: "admin_profile",
    targetId: target.id,
    metadata: {
      targetAuthUserId: target.authUserId,
      fromRole: target.role,
      toRole: AdminRole.Viewer,
      memberIdCleared: true,
    },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ saved: true });
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm exec tsc --noEmit
```

Fix any Prisma/import issues before committing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/admin-committee-profiles.ts
git commit -m "feat(actions): Owner CRUD-lite for committee admin profiles"
```

---

### Task 6: Vitest for server actions (mocked prisma)

**Files:**
- Create: `src/lib/actions/admin-committee-profiles.test.ts`

- [ ] **Step 1: Write tests with vi.mock**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adminProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    masterMember: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/actions/guard", () => ({
  guardOwner: vi.fn().mockResolvedValue({
    profileId: "actor_prof",
    role: "Owner",
    helperEventIds: [],
    authUserId: "actor_user",
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/audit/append-club-audit-log", () => ({
  appendClubAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { AdminRole } from "@prisma/client";
import {
  addCommitteeAdminByEmail,
  updateCommitteeAdminRole,
  revokeCommitteeAdminMeaningfulAccess,
} from "@/lib/actions/admin-committee-profiles";

describe("addCommitteeAdminByEmail", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findFirst).mockReset();
    vi.mocked(prisma.adminProfile.findUnique).mockReset();
    vi.mocked(prisma.adminProfile.create).mockReset();
  });

  it("returns root error when user missing", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("email", "nobody@example.com");
    const r = await addCommitteeAdminByEmail(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("email");
  });

  it("creates Viewer profile when user exists without profile", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: "u_new" } as never);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.adminProfile.create).mockResolvedValueOnce({
      id: "prof_new",
    } as never);
    const fd = new FormData();
    fd.set("email", "new@example.com");
    const r = await addCommitteeAdminByEmail(undefined, fd);
    expect(r.ok).toBe(true);
  });
});

describe("updateCommitteeAdminRole / revoke", () => {
  beforeEach(() => {
    vi.mocked(prisma.adminProfile.findMany).mockReset();
    vi.mocked(prisma.adminProfile.findUnique).mockReset();
    vi.mocked(prisma.adminProfile.update).mockReset();
  });

  it("blocks demoting sole Owner", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p1",
      authUserId: "only_owner",
      role: AdminRole.Owner,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "only_owner" },
    ] as never);

    const fd = new FormData();
    fd.set("adminProfileId", "p1");
    fd.set("role", "Admin");
    const r = await updateCommitteeAdminRole(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("Owner");
  });

  it("allows demoting Owner when another exists", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p1",
      authUserId: "o1",
      role: AdminRole.Owner,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "o1" },
      { authUserId: "o2" },
    ] as never);

    const fd = new FormData();
    fd.set("adminProfileId", "p1");
    fd.set("role", "Admin");
    const r = await updateCommitteeAdminRole(undefined, fd);
    expect(r.ok).toBe(true);
  });

  it("blocks revoke on sole Owner", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p1",
      authUserId: "only_owner",
      role: AdminRole.Owner,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "only_owner" },
    ] as never);

    const fd = new FormData();
    fd.set("adminProfileId", "p1");
    const r = await revokeCommitteeAdminMeaningfulAccess(undefined, fd);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm vitest run src/lib/actions/admin-committee-profiles.test.ts
```

Expected: PASS (adjust mocks if guard context type requires extra fields).

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/admin-committee-profiles.test.ts
git commit -m "test(actions): committee admin profiles owner invariants"
```

---

### Task 7: Client panel (table + dialogs)

**Files:**
- Create: `src/components/admin/committee-admin-settings-panel.tsx`

- [ ] **Step 1: Create `src/components/admin/committee-admin-settings-panel.tsx`**

Implementasi lengkap berikut menyamakan pola `useActionState` + `Alert` seperti `committee-default-pricing-form.tsx` dan `Dialog` bermuatan seperti `cancel-refund-panel.tsx`. Setelah penyimpanan sukses (`state?.ok === true`), tutup dialog terkait; gunakan increment `useState` key (`manageKey`, `addKey`) bila perlu untuk mereset state action ketika membuka lagi.

```tsx
"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type {
  CommitteeAdminDirectoryRowVm,
  CommitteeAdminDirectoryVm,
} from "@/lib/admin/load-committee-admin-directory";
import {
  addCommitteeAdminByEmail,
  revokeCommitteeAdminMeaningfulAccess,
  updateCommitteeAdminMemberLink,
  updateCommitteeAdminRole,
} from "@/lib/actions/admin-committee-profiles";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActionResult } from "@/lib/forms/action-result";

const ROLE_LABELS: Record<string, string> = {
  Owner: "Owner",
  Admin: "Admin",
  Verifier: "Verifier",
  Viewer: "Viewer",
};

function formatSessionHint(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fieldErrorsLines(fieldErrors?: Record<string, string>) {
  if (!fieldErrors || Object.keys(fieldErrors).length === 0) return null;
  return Object.entries(fieldErrors)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

type ManageFormsProps = {
  row: CommitteeAdminDirectoryRowVm;
  memberOptions: CommitteeAdminDirectoryVm["memberOptions"];
  onAnySuccess: () => void;
  manageKey: number;
};

function ManageAdminDialogs(props: ManageFormsProps) {
  const { row } = props;

  const [roleState, roleDispatch, rolePending] = useActionState(
    updateCommitteeAdminRole,
    null as ActionResult<{ saved: true }> | null,
  );
  const [memberState, memberDispatch, memberPending] = useActionState(
    updateCommitteeAdminMemberLink,
    null as ActionResult<{ saved: true }> | null,
  );
  const [revokeState, revokeDispatch, revokePending] = useActionState(
    revokeCommitteeAdminMeaningfulAccess,
    null as ActionResult<{ saved: true }> | null,
  );

  useEffect(() => {
    if (roleState?.ok || memberState?.ok || revokeState?.ok) {
      props.onAnySuccess();
    }
  }, [
    roleState?.ok,
    memberState?.ok,
    revokeState?.ok,
    props.onAnySuccess,
  ]);

  const flagLinesRole = fieldErrorsLines(
    roleState?.ok === false ? roleState.fieldErrors : undefined,
  );
  const flagLinesMember = fieldErrorsLines(
    memberState?.ok === false ? memberState.fieldErrors : undefined,
  );
  const flagLinesRevoke = fieldErrorsLines(
    revokeState?.ok === false ? revokeState.fieldErrors : undefined,
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          Ubah peran
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah peran admin</DialogTitle>
            <DialogDescription>
              {props.row.email} — peran baru berlaku segera setelah disimpan.
            </DialogDescription>
          </DialogHeader>
          <form action={roleDispatch} className="space-y-4" key={`r-${props.manageKey}-${row.adminProfileId}`}>
            <input type="hidden" name="adminProfileId" value={row.adminProfileId} />
            {roleState?.ok === false && roleState.rootError ? (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{roleState.rootError}</AlertDescription>
              </Alert>
            ) : null}
            {flagLinesRole ? (
              <Alert variant="destructive">
                <AlertTitle>Periksa isian</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
                  {flagLinesRole}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`role-${row.adminProfileId}`}>Peran</Label>
              <select
                id={`role-${row.adminProfileId}`}
                name="role"
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                defaultValue={row.role}
                disabled={rolePending}
                required
              >
                <option value="Owner">Owner</option>
                <option value="Admin">Admin</option>
                <option value="Verifier">Verifier</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={rolePending}>
                {rolePending ? <Loader2 className="size-4 animate-spin" /> : "Simpan peran"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          Tautan anggota
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hubungkan ke MasterMember</DialogTitle>
            <DialogDescription>
              Opsional. PIC, rekening, dan flag PIC dikelola di halaman Anggota.
            </DialogDescription>
          </DialogHeader>
          <form action={memberDispatch} className="space-y-4" key={`m-${props.manageKey}-${row.adminProfileId}`}>
            <input type="hidden" name="adminProfileId" value={row.adminProfileId} />
            {memberState?.ok === false && memberState.rootError ? (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{memberState.rootError}</AlertDescription>
              </Alert>
            ) : null}
            {flagLinesMember ? (
              <Alert variant="destructive">
                <AlertTitle>Periksa isian</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
                  {flagLinesMember}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`member-${row.adminProfileId}`}>Anggota</Label>
              <select
                id={`member-${row.adminProfileId}`}
                name="memberId"
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                defaultValue={row.memberId ?? ""}
                disabled={memberPending}
              >
                <option value="">— Tidak dikaitkan</option>
                {props.memberOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={memberPending}>
                {memberPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Simpan tautan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger render={<Button variant="destructive" size="sm" />}>
          Cabut akses
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cabut akses bermakna</DialogTitle>
            <DialogDescription>
              Mengatur peran menjadi Viewer dan menghapus tautan anggota untuk{" "}
              <strong>{row.email}</strong>. Profil tidak dihapus.
            </DialogDescription>
          </DialogHeader>
          {revokeState?.ok === false && revokeState.rootError ? (
            <Alert variant="destructive">
              <AlertTitle>Gagal</AlertTitle>
              <AlertDescription>{revokeState.rootError}</AlertDescription>
            </Alert>
          ) : null}
          {flagLinesRevoke ? (
            <Alert variant="destructive">
              <AlertTitle>Periksa isian</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
                {flagLinesRevoke}
              </AlertDescription>
            </Alert>
          ) : null}
          <form action={revokeDispatch} key={`v-${props.manageKey}-${row.adminProfileId}`}>
            <input type="hidden" name="adminProfileId" value={row.adminProfileId} />
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={revokePending}>
                {revokePending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Ya, cabut akses"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CommitteeAdminSettingsPanel(props: {
  directory: CommitteeAdminDirectoryVm;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [manageKey, setManageKey] = useState(0);

  const onManageSuccess = useCallback(() => {
    setManageKey((k) => k + 1);
  }, []);

  const [addState, addDispatch, addPending] = useActionState(
    addCommitteeAdminByEmail,
    null as ActionResult<{ created: true }> | null,
  );

  useEffect(() => {
    if (addState?.ok) {
      setAddOpen(false);
      setAddKey((k) => k + 1);
    }
  }, [addState]);

  const addFieldLines = fieldErrorsLines(
    addState?.ok === false ? addState.fieldErrors : undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Admin terdaftar</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button />}>Tambah admin…</DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah admin dari email</DialogTitle>
              <DialogDescription>
                Pengguna harus sudah punya akun (pernah masuk atau mendaftar). Peran default: Viewer — ubah melalui &ldquo;Ubah peran&rdquo;.
              </DialogDescription>
            </DialogHeader>
            <form action={addDispatch} className="space-y-4" key={`add-${addKey}`}>
              {addState?.ok === false && addState.rootError ? (
                <Alert variant="destructive">
                  <AlertTitle>Gagal</AlertTitle>
                  <AlertDescription>{addState.rootError}</AlertDescription>
                </Alert>
              ) : null}
              {addFieldLines ? (
                <Alert variant="destructive">
                  <AlertTitle>Periksa isian</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
                    {addFieldLines}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="committee-admin-email">Email</Label>
                <Input
                  id="committee-admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={addPending}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={addPending}>
                  {addPending ? <Loader2 className="size-4 animate-spin" /> : "Tambahkan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Anggota terkait</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>Aktivitas sesi*</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.directory.rows.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={7}>
                  Belum ada AdminProfile.
                </TableCell>
              </TableRow>
            ) : (
              props.directory.rows.map((row) => (
                <TableRow key={row.adminProfileId}>
                  <TableCell className="font-mono text-xs sm:text-sm">
                    {row.email}
                  </TableCell>
                  <TableCell>{row.displayName}</TableCell>
                  <TableCell>{ROLE_LABELS[row.role] ?? row.role}</TableCell>
                  <TableCell>{row.memberSummary ?? "—"}</TableCell>
                  <TableCell>{row.twoFactorEnabled ? "Ya" : "Tidak"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatSessionHint(row.lastSessionActivityAtIso)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ManageAdminDialogs
                      row={row}
                      memberOptions={props.directory.memberOptions}
                      manageKey={manageKey}
                      onAnySuccess={onManageSuccess}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        <span className="font-medium text-foreground">*</span> Berdasarkan sesi aktif yang belum kedaluwarsa (pembaruan terbaru dari tabel sessi Better Auth).
        Untuk rekonsiliasi lebih lengkap pakai halaman Pengaturan → Keamanan (log audit). Darurat penyediaan akun baru masih bisa lewat CLI{" "}
        <code className="font-mono text-[11px]">pnpm bootstrap:admin</code>.
      </p>
    </div>
  );
}
```

**Catatan perilaku Dialog:** Basis UI tidak menutup otomatis `Dialog` pembuka `DialogTrigger` setelah submit sukses; peningkatan opsional kemudian adalah mengontrol `open`/`onOpenChange` untuk setiap dialog kelola seperti pola `cancel-refund-panel.tsx`. Pada MVP mengunci rencana ini, meningkatkan `manageKey` setelah sukses sudah mencukupi untuk mereset form state berikutnya. Bungkus `onAnySuccess` di parent dengan `useCallback` agar `useEffect` di `ManageAdminDialogs` tidak terpicu ulang setiap render.

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/committee-admin-settings-panel.tsx
git commit -m "feat(ui): committee admin directory panel with owner actions"
```

---

### Task 8: Page + hub copy

**Files:**
- Modify: `src/app/admin/settings/committee/page.tsx`
- Modify: `src/app/admin/settings/page.tsx`

- [ ] **Step 1: Update committee page**

Ganti konten utama dengan pola:

```typescript
import Link from "next/link";

import { CommitteeAdminSettingsPanel } from "@/components/admin/committee-admin-settings-panel";
import { loadCommitteeAdminDirectory } from "@/lib/admin/load-committee-admin-directory";

export default async function CommitteeSettingsPage() {
  const directory = await loadCommitteeAdminDirectory();

  return (
    <div className="space-y-8">
      {/* Breadcrumb tetap seperti sekarang */}
      {/* H1 */}
      {/* Paragraf §B spek + alur langkah */}
      {/* Card ringkas CTA Anggota + Keamanan (audit) */}
      <CommitteeAdminSettingsPanel directory={directory} />
    </div>
  );
}
```

Salin styling teks pembuka dari halaman eksisting tetapi perluas dengan alur:

1. Data anggota / PIC ada di direktori **Anggota**.  
2. Pengguna baru harus bisa masuk (**Better Auth**).  
3. Owner menambahkan email di panel di bawah.  
4. Taut opsional **`MasterMember`** untuk verifikasi PIC.

Hapus paragraf yang mengatakan perubahan *hanya* via bootstrap sebagai satu-satunya cara — ganti dengan “bootstrap tetap untuk darurat / scripting”.

- [ ] **Step 2: Update hub kartu**

Di `src/app/admin/settings/page.tsx`, ubah `description` kartu Komite menjadi menekankan **pengelolaan admin aplikasi**, misalnya:

`"Kelola akses Owner/Admin/Verifier/Viewer dan hubungan opsional ke anggota; PIC serta rekening dari Anggota."`

- [ ] **Step 3: Run lint + vitest pintasan**

```bash
pnpm lint
pnpm vitest run src/lib/admin/committee-owner-invariants.test.ts src/lib/actions/admin-committee-profiles.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/settings/committee/page.tsx src/app/admin/settings/page.tsx
git commit -m "feat(admin): wire committee directory page + hub description"
```

---

## Spec self-review (plan author)

**1. Spec coverage**

| Spec | Task |
|------|------|
| A tambah oleh email User ada | Task 5 `addCommitteeAdminByEmail`, Task 6 tests |
| A ubah peran + invariant Owner | Task 5, 1 |
| A memberId set/clear | Task 5 `updateCommitteeAdminMemberLink` |
| A cabut bermakna Viewer + clear member | Task 5 `revokeCommitteeAdminMeaningfulAccess` |
| B copy & CTA Anggota / hub | Task 8 |
| C 2FA + aktivitas sesi non-kadaluarsa | Task 4 loader, Task 7 tampilan |
| Non-goals invite email / IP UA | Tidak ada task |
| Audit tiga jalur (+ revoke memakai role_changed dengan metadata) | Task 5 + Task 2 |
| §7 testing | Tasks 1, 6, 8 lint/vitest |

**2. Placeholder scan** — tidak ada TODO/TBD/`implement later`; Task 7 memuat cuplikan TSX panel siap salin lengkap ditambahkan field `memberId` pada loader Task 4.

**3. Type consistency** — `AdminRole` dari `@prisma/client`; `committee-owner-invariants` memakai `AdminRole` generik; schemas memakai enum yang sama; server actions menggunakan `parsed.data.role` bertipe sama.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-02-committee-admin-management.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**



