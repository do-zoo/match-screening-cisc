# Pengaturan rekening PIC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memungkinkan admin membaca dan mengelola `PicBankAccount` per profil dari UI **Komite**, dengan pembatas role sesuai spec, serta memastikan form acara hanya menggunakan rekening aktif untuk pilihan PIC (validasi server sudah sebagian besar ada).

**Architecture:** Tambah helper izin mutasi berbasis **`AdminRole` + pemilik session `profileId`**; **`loadCommitteeAdminDirectory`** memuat sekalian baris bank per profil; **Server Actions** terpusat **`admin-pic-bank-accounts.ts`** untuk create/update/nonaktif/hapus; UI pada baris bisa di-expand menampilkan sub-komponen khusus bank. **`/admin/settings/layout.tsx`** dibuka untuk semua profil admin; setiap halaman **lanjutan selain Komite** dilindungi **`layout.tsx` anak** yang memerlukan **`canManageCommitteeAdvancedSettings`** (Owner), agar pemisahan akses jelas sesuai spec (Verifier/Viewer hanya bisa masuk **Komite**).

**Tech Stack:** Next.js App Router, Prisma (`PicBankAccount`, `Event`), Better Auth (`requireAdminSession` + `getAdminContext`), Vitest (`vi.mock("@/lib/db/prisma")`), `zod`, `react-hook-form` opsional atau form `<form action>` pola komite seperti `ManageAdminDialogs`.

---

## File structure (what changes)

| Path | Responsibility |
|------|----------------|
| `src/lib/admin/pic-bank-account-permissions.ts` (**baru**) | Fungsi murni `canViewPicBankList`, `canMutatePicBankForTarget(profileId?, role?, targetOwnerProfileId)`. |
| `src/lib/forms/pic-bank-account-schema.ts` (**baru**) | Skema FormData/`zod` untuk create/update/nonaktif/hapus. |
| `src/lib/actions/admin-pic-bank-accounts.ts` (**baru**) | Server actions CRUD-ish + pesan gagal bahasa Indonesia + `appendClubAuditLog` + `revalidatePath`. |
| `src/lib/actions/admin-pic-bank-accounts.test.ts` (**baru**) | Unit guard + cabang utama tanpa Postgres nyata (`vi.mock prisma`). |
| `src/lib/audit/club-audit-actions.ts` | Tambah konstante audit PIC bank (created / updated / deactivated / deleted). |
| `src/lib/admin/load-committee-admin-directory.ts` | Tambah `picBankAccounts` per row (query `picBankAccount.findMany` satu kali → map per owner). |
| `src/app/admin/settings/layout.tsx` | Lepaskan cek Owner; tetap **`requireAdminSession` + AdminContext ada** atau `notFound()`. |
| `src/app/admin/settings/page.tsx` | Jadi server async guard Owner-only (`notFound` jika bukan Owner). Opsional pesan lebih ramah bisa ditunda (YAGNI). |
| `src/app/admin/settings/pricing/layout.tsx` … `security/layout.tsx` (**baru** per folder sensitif | `pricing`, `whatsapp-templates`, `branding`, `notifications`, `operations`, `security`) | Masing‑masing: `await getAdminContext` + kalau tidak `canManageCommitteeAdvancedSettings(role)` → `notFound()`. |
| `src/app/admin/settings/committee/page.tsx` | Tanpa Owner guard tambahan; **`getAdminContext`** + pass ke panel **kapabilitas** (`role`, `viewerProfileId`). |
| `src/components/admin/admin-pic-bank-accounts-inline.tsx` (**baru**, `"use client"`) | Expand + daftar bank + tombol/s form terhadap props kapabilitas. |
| `src/components/admin/committee-admin-settings-panel.tsx` | Props kapabilitas; sembunyikan **Undang** + **Undangan tertunda** + tautan/export yang Owner-only atau sesuai aturan Anda (minimal: tombol CSV & undang Owner-only seperti sekarang untuk export route); expandable row + inline bank UI. |

**Tanpa mengubah** `schema.prisma`. **`src/app/api/admin/pic-banks/[adminProfileId]/route.ts`** tetap filter `isActive: true` (sudah sesuai spec); verifikasi saja tidak regres.

**Catatan kepatuhan dengan kode eksisting:**

- **`validatePicBankAndHelpers`** di `src/lib/actions/admin-events.ts` **sudah** memerlukan **`isActive: true`** untuk `bankAccountId` pemilihan baru — tidak perlu duplikasi aturan utama; tes regresional opsional bisa berupa skim manual.

---

### Task 1: Helper izin rekening (tanpa tes dulu — kecil dan dipanggil tes Task 3)

**Files:**
- Create: `src/lib/admin/pic-bank-account-permissions.ts`

- [ ] **Step 1: Tambah helper**

Buat konten tepat seperti berikut:

```typescript
import type { AdminRole } from "@/lib/permissions/roles";

/** Sesuai spec: pembaca bisa semua yang sudah akses konteks Komite — gate dilakukan route. */
export function canViewPicBankListDetails(_viewerRole: AdminRole): boolean {
  return true;
}

/**
 * Mutasi CRUD-ish rekening:
 * - Owner / Admin: semua target
 * - Verifier / role lainnya (kec Viewer): hanya milik sendiri (`targetOwnerProfileId === viewerProfileId`)
 * - Viewer: tidak pernah mutasi melalui UI (server tetap blok)
 */
export function canMutatePicBankForTarget(
  viewerRole: AdminRole,
  viewerProfileId: string,
  targetOwnerProfileId: string,
): boolean {
  if (viewerRole === "Viewer") return false;
  if (viewerRole === "Owner" || viewerRole === "Admin") return true;
  return viewerProfileId === targetOwnerProfileId;
}

export function viewerMayUseOwnerOnlyCommitteeControls(
  viewerRole: AdminRole,
): boolean {
  return viewerRole === "Owner";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin/pic-bank-account-permissions.ts
git commit -m "feat(admin): helpers izin mutasi PIC bank per profil"
```

---

### Task 2: Rute pengaturan — Komite boleh non-Owner; modul lanjutan Owner-only di layout anak

**Files:**
- Modify: `src/app/admin/settings/layout.tsx`
- Modify: `src/app/admin/settings/page.tsx`
- Create: `src/app/admin/settings/pricing/layout.tsx`
- Create: `src/app/admin/settings/whatsapp-templates/layout.tsx`
- Create: `src/app/admin/settings/branding/layout.tsx`
- Create: `src/app/admin/settings/notifications/layout.tsx`
- Create: `src/app/admin/settings/operations/layout.tsx`
- Create: `src/app/admin/settings/security/layout.tsx`

- [ ] **Step 1: Ganti wrapper `layout.tsx` induk**

Ganti seluruh isi **`src/app/admin/settings/layout.tsx`** dengan pola **hanya sesi**:

```tsx
import { notFound } from "next/navigation";

import { CommitteeSettingsSubnav } from "@/components/admin/committee-settings-subnav";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";

export default async function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 lg:flex-row lg:gap-10 lg:py-10">
      <aside className="lg:w-56 lg:shrink-0 lg:overflow-visible">
        <CommitteeSettingsSubnav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </main>
  );
}
```

- [ ] **Step 2: Halaman hub `/admin/settings` Owner-only**

Ganti seluruh isi **`src/app/admin/settings/page.tsx`** menjadi:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function AdminSettingsHubPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan komite</h1>
        <p className="text-muted-foreground text-sm">
          Konfigurasi lanjutan klub — hanya Owner. Pilih modul di atas (seluler: geser), sidebar di
          layar besar, atau kartu di bawah.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsCard
          href="/admin/settings/committee"
          title="Komite & admin"
          description="Kelola akses aplikasi dan peran (Owner/Admin/Verifier/Viewer); tautan opsional ke anggota; rekening PIC dilampirkan ke profil admin."
        />
        <SettingsCard
          href="/admin/settings/pricing"
          title="Harga default"
          description="Nilai awal tiket saat acara memakai default komite."
        />
        <SettingsCard
          href="/admin/settings/whatsapp-templates"
          title="Template WhatsApp"
          description="Isi pesan untuk tautan wa.me di admin; placeholder {snake_case}; fallback ke bawaan kode."
        />
        <SettingsCard
          href="/admin/settings/branding"
          title="Branding"
          description="Judul navigasi, logo situs (WebP), dan teks footer untuk halaman publik."
        />
        <SettingsCard
          href="/admin/settings/notifications"
          title="Notifikasi"
          description="Mode saluran keluar (stub vs live) dan label internal; terpisah dari pemasangan SMTP/Resend."
        />
        <SettingsCard
          href="/admin/settings/operations"
          title="Operasional"
          description="Tutup pendaftaran situs secara global dan banner pemeliharaan untuk pengunjung."
        />
        <SettingsCard
          href="/admin/settings/security"
          title="Keamanan"
          description="Log audit konfigurasi komite dan informasi 2FA (Better Auth)."
        />
      </div>
    </div>
  );
}

function SettingsCard(props: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={props.href} className="block">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardTitle className="text-base">{props.title}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 3: Layout Owner-only berturut-turut (satu pola untuk enam folder)**

Contoh **`src/app/admin/settings/pricing/layout.tsx`** (ulangi dengan struktur sama untuk enam path modul sensitif dalam tabel struktur atas):

```tsx
import { notFound } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

export default async function CommitteePricingGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) {
    notFound();
  }
  return <>{children}</>;
}
```

- [ ] **Step 4: Uji akses secara manual cepat**

1. Seed / login sebagai **Verifier** kalau Anda punya sandbox: **`GET /admin/settings/committee`** harus mengembalikan 200.

2. **Verifier**: **`GET /admin/settings/pricing`** harus 404 (**`notFound()`**).

Owner: akses dua-duanya 200.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/settings/layout.tsx src/app/admin/settings/page.tsx src/app/admin/settings/pricing/layout.tsx src/app/admin/settings/whatsapp-templates/layout.tsx src/app/admin/settings/branding/layout.tsx src/app/admin/settings/notifications/layout.tsx src/app/admin/settings/operations/layout.tsx src/app/admin/settings/security/layout.tsx
git commit -m "fix(settings): akses Komite luas untuk profil admin, modul lanjutan tetap Owner"
```

---

### Task 3: Tes untuk helper izin (TDD atas Task 1)

**Files:**
- Create: `src/lib/admin/pic-bank-account-permissions.test.ts`

- [ ] **Step 1: Tulis tes yang gagal terlebih dulu**

```typescript
import { describe, expect, it } from "vitest";

import {
  canMutatePicBankForTarget,
  viewerMayUseOwnerOnlyCommitteeControls,
} from "@/lib/admin/pic-bank-account-permissions";

describe("pic-bank-account-permissions", () => {
  const self = "profile-self";
  const other = "profile-other";

  it("blocks Viewer mutating anybody", () => {
    expect(
      canMutatePicBankForTarget("Viewer", self, self),
    ).toBe(false);
  });

  it("allows Owner to mutate anybody", () => {
    expect(canMutatePicBankForTarget("Owner", self, other)).toBe(true);
  });

  it("allows Admin to mutate anybody", () => {
    expect(canMutatePicBankForTarget("Admin", self, other)).toBe(true);
  });

  it("Verifier may mutate only own profile-owned banks", () => {
    expect(canMutatePicBankForTarget("Verifier", self, self)).toBe(true);
    expect(canMutatePicBankForTarget("Verifier", self, other)).toBe(false);
  });

  it("viewerMayUseOwnerOnlyCommitteeControls Owner only", () => {
    expect(viewerMayUseOwnerOnlyCommitteeControls("Owner")).toBe(true);
    expect(viewerMayUseOwnerOnlyCommitteeControls("Admin")).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan Vitest sampai PASS**

Run:

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/admin/pic-bank-account-permissions.test.ts
```

Harapan: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/pic-bank-account-permissions.test.ts
git commit -m "test(admin): PIC bank permission helpers"
```

---

### Task 4: Tambah audit actions + schemas form

**Files:**
- Modify: `src/lib/audit/club-audit-actions.ts`
- Create: `src/lib/forms/pic-bank-account-schema.ts`

- [ ] **Step 1: Konstante audit baru**

Append ke objek **`CLUB_AUDIT_ACTION`** (sebelum **`as const`**), termasuk dua aksi pisah untuk nonaktif vs hapus:

```typescript
PIC_BANK_CREATED: "pic_bank.created",
PIC_BANK_UPDATED: "pic_bank.updated",
PIC_BANK_DEACTIVATED: "pic_bank.deactivated",
PIC_BANK_DELETED: "pic_bank.deleted",
```

- [ ] **Step 2: Schemas**

```typescript
import { z } from "zod";

export const createPicBankAccountSchema = z.object({
  ownerAdminProfileId: z.string().min(1),
  bankName: z.string().trim().min(1, "Nama bank wajib diisi."),
  accountNumber: z.string().trim().min(1, "Nomor rekening wajib diisi."),
  accountName: z.string().trim().min(1, "Nama pemilik rekening wajib diisi."),
});

export const updatePicBankAccountSchema = z.object({
  bankAccountId: z.string().min(1),
  ownerAdminProfileId: z.string().min(1),
  bankName: z.string().trim().min(1, "Nama bank wajib diisi."),
  accountNumber: z.string().trim().min(1, "Nomor rekening wajib diisi."),
  accountName: z.string().trim().min(1, "Nama pemilik rekening wajib diisi."),
});

export const targetPicBankOwnerSchema = z.object({
  bankAccountId: z.string().min(1),
  ownerAdminProfileId: z.string().min(1),
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/audit/club-audit-actions.ts src/lib/forms/pic-bank-account-schema.ts
git commit -m "feat(admin): schema & audit PIC bank"
```

---

### Task 5: Server actions PIC bank (+ unit tests mock Prisma)

**Files:**
- Create: `src/lib/actions/admin-pic-bank-accounts.ts`
- Create: `src/lib/actions/admin-pic-bank-accounts.test.ts`

- [ ] **Step 1: Implementasi utama `admin-pic-bank-accounts.ts`**

Kerangka wajib (lengkapi impor paralel pola `admin-committee-profiles.ts`):

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { prisma } from "@/lib/db/prisma";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import type { AdminRole } from "@/lib/permissions/roles";
import { canMutatePicBankForTarget } from "@/lib/admin/pic-bank-account-permissions";
import {
  createPicBankAccountSchema,
  targetPicBankOwnerSchema,
  updatePicBankAccountSchema,
} from "@/lib/forms/pic-bank-account-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { isAuthError } from "@/lib/actions/guard";

async function requirePicBankMutationContext(ownerAdminProfileId: string): Promise<
  ActionResult<never> | {
    viewerProfileId: string;
    role: AdminRole;
    authUserId: string;
  }
> {
  try {
    const session = await requireAdminSession();
    const ctx = await getAdminContext(session.user.id);
    if (!ctx) return rootError("Tidak diizinkan.");
    if (
      !canMutatePicBankForTarget(ctx.role, ctx.profileId, ownerAdminProfileId)
    ) {
      return rootError("Tidak diizinkan.");
    }
    return {
      viewerProfileId: ctx.profileId,
      role: ctx.role,
      authUserId: session.user.id,
    };
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }
}

export async function createPicBankAccount(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createPicBankAccountSchema.safeParse({
    ownerAdminProfileId: formData.get("ownerAdminProfileId"),
    bankName: formData.get("bankName"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const gate = await requirePicBankMutationContext(parsed.data.ownerAdminProfileId);
  if (!("viewerProfileId" in gate)) return gate;

  const row = await prisma.picBankAccount.create({
    data: {
      ownerAdminProfileId: parsed.data.ownerAdminProfileId,
      bankName: parsed.data.bankName,
      accountNumber: parsed.data.accountNumber,
      accountName: parsed.data.accountName,
      isActive: true,
    },
    select: { id: true },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.viewerProfileId,
    actorAuthUserId: gate.authUserId,
    action: CLUB_AUDIT_ACTION.PIC_BANK_CREATED,
    targetType: "pic_bank_account",
    targetId: row.id,
    metadata: { ownerAdminProfileId: parsed.data.ownerAdminProfileId },
  });

  revalidatePath("/admin/settings/committee");
  revalidatePath("/admin/events", "layout");
  return ok({ id: row.id });
}

export async function updatePicBankAccount(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const parsed = updatePicBankAccountSchema.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    ownerAdminProfileId: formData.get("ownerAdminProfileId"),
    bankName: formData.get("bankName"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const gate = await requirePicBankMutationContext(parsed.data.ownerAdminProfileId);
  if (!("viewerProfileId" in gate)) return gate;

  const existing = await prisma.picBankAccount.findFirst({
    where: {
      id: parsed.data.bankAccountId,
      ownerAdminProfileId: parsed.data.ownerAdminProfileId,
    },
    select: { id: true },
  });
  if (!existing) return rootError("Rekening tidak ditemukan.");

  await prisma.picBankAccount.update({
    where: { id: parsed.data.bankAccountId },
    data: {
      bankName: parsed.data.bankName,
      accountNumber: parsed.data.accountNumber,
      accountName: parsed.data.accountName,
    },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.viewerProfileId,
    actorAuthUserId: gate.authUserId,
    action: CLUB_AUDIT_ACTION.PIC_BANK_UPDATED,
    targetType: "pic_bank_account",
    targetId: parsed.data.bankAccountId,
    metadata: {},
  });

  revalidatePath("/admin/settings/committee");
  revalidatePath("/admin/events", "layout");
  return ok({ saved: true });
}

export async function deactivatePicBankAccount(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const parsed = targetPicBankOwnerSchema.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    ownerAdminProfileId: formData.get("ownerAdminProfileId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const gate = await requirePicBankMutationContext(parsed.data.ownerAdminProfileId);
  if (!("viewerProfileId" in gate)) return gate;

  const row = await prisma.picBankAccount.findFirst({
    where: {
      id: parsed.data.bankAccountId,
      ownerAdminProfileId: parsed.data.ownerAdminProfileId,
    },
    select: { id: true },
  });
  if (!row) return rootError("Rekening tidak ditemukan.");

  await prisma.picBankAccount.update({
    where: { id: row.id },
    data: { isActive: false },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.viewerProfileId,
    actorAuthUserId: gate.authUserId,
    action: CLUB_AUDIT_ACTION.PIC_BANK_DEACTIVATED,
    targetType: "pic_bank_account",
    targetId: row.id,
    metadata: {},
  });

  revalidatePath("/admin/settings/committee");
  revalidatePath("/admin/events", "layout");
  return ok({ saved: true });
}

export async function deletePicBankAccountPermanent(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  const parsed = targetPicBankOwnerSchema.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    ownerAdminProfileId: formData.get("ownerAdminProfileId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const gate = await requirePicBankMutationContext(parsed.data.ownerAdminProfileId);
  if (!("viewerProfileId" in gate)) return gate;

  const used = await prisma.event.count({
    where: { bankAccountId: parsed.data.bankAccountId },
  });
  if (used > 0) {
    return rootError(
      "Rekening masih dipakai oleh satu atau lebih acara. Ganti rekening di acara tersebut atau nonaktifkan saja.",
    );
  }

  const row = await prisma.picBankAccount.findFirst({
    where: {
      id: parsed.data.bankAccountId,
      ownerAdminProfileId: parsed.data.ownerAdminProfileId,
    },
    select: { id: true },
  });
  if (!row) return rootError("Rekening tidak ditemukan.");

  await prisma.picBankAccount.delete({ where: { id: row.id } });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.viewerProfileId,
    actorAuthUserId: gate.authUserId,
    action: CLUB_AUDIT_ACTION.PIC_BANK_DELETED,
    targetType: "pic_bank_account",
    targetId: row.id,
    metadata: {},
  });

  revalidatePath("/admin/settings/committee");
  revalidatePath("/admin/events", "layout");
  return ok({ deleted: true });
}
```

- [ ] **Step 2: Uji gagal tes — mocking**

Di **`admin-pic-bank-accounts.test.ts`**, pola serupa **`admin-committee-profiles.test.ts`**:

Mock `requireAdminSession`, `getAdminContext`, `appendClubAuditLog`, `revalidatePath`, dan chain Prisma **`picBankAccount.create`**, **`findFirst`**, **`update`**, **`count`**, **`delete`**.

Tes minimal yang wajib:

1. Viewer → **`createPicBankAccount`** mengembalikan **`{ ok: false, rootError: "..." }`** atau pesan gagal Anda.

2. Verifier salah profil (**`ownerAdminProfileId` lain**) → blok.

3. **`deletePicBankAccountPermanent`** saat **`event.count` mengembalikan `1`** → **`rootError`** berisi kata kunci Anda.

Contoh blok awal tes (adaptasi mocking internal project):

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireAdminSession: vi.fn(),
}));
vi.mock("@/lib/auth/admin-context", () => ({
  getAdminContext: vi.fn(),
}));
vi.mock("@/lib/audit/append-club-audit-log", () => ({
  appendClubAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { prisma } = await import("@/lib/db/prisma");

describe("admin-pic-bank-accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reject Viewer create", async () => {
    // set requireAdminSession → { user: { id: "u" } }; getAdminContext → { profileId:"p", role:"Viewer" }
    // expect create tidak dipanggil
  });
});
```

Lengkapi stub mock mengikuti gaya tepat **`src/lib/actions/admin-committee-profiles.test.ts`**.

Run:

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/admin-pic-bank-accounts.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/admin-pic-bank-accounts.ts src/lib/actions/admin-pic-bank-accounts.test.ts src/lib/forms/pic-bank-account-schema.ts src/lib/audit/club-audit-actions.ts
git commit -m "feat(admin): server actions kelola PIC bank + tests"
```

---

### Task 6: Muat baris bank ke directory komite

**Files:**
- Modify: `src/lib/admin/load-committee-admin-directory.ts`

- [ ] **Step 1: Perluas VM row**

Di **`CommitteeAdminDirectoryRowVm`** tambahkan:

```typescript
picBankAccounts: Array<{
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
}>;
```

- [ ] **Step 2: Query tunggal + map**

Selepas blok query profil paralel Anda, jalankan **`prisma.picBankAccount.findMany({ orderBy:[{ownerAdminProfileId:"asc"}, {bankName:"asc"}], select: { … } })`**, kemudian `Map<string, typeof rows>` keyed by **`ownerAdminProfileId`**.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/load-committee-admin-directory.ts
git commit -m "feat(admin): include PIC bank rows in committee directory loader"
```

---

### Task 7: UI expandable + sub-komponen bank + kapabilitas panel komite

**Files:**
- Create: `src/components/admin/admin-pic-bank-accounts-inline.tsx`
- Modify: `src/components/admin/committee-admin-settings-panel.tsx`
- Modify: `src/app/admin/settings/committee/page.tsx`

- [ ] **Step 1: Pass konteks viewer dari halaman Komite**

Ubah **`src/app/admin/settings/committee/page.tsx`** menjadi mengambil viewer terlebih dulu (**`session.user.id`** seperti sisa codebase), kemudian meneruskan props:

```tsx
const session = await requireAdminSession();
const viewerCtx = await getAdminContext(session.user.id);
// jika viewerCtx null → notFound(); atau blok Alert konsisten pola admin lain Anda

const [directory, pendingInvitations] = await Promise.all([
  loadCommitteeAdminDirectory(),
  loadPendingAdminInvitationsForCommittee(),
]);

return (
  /* … */
  <CommitteeAdminSettingsPanel
    viewerProfileId={viewerCtx.profileId}
    viewerRole={viewerCtx.role}
    directory={directory}
    pendingInvitations={pendingInvitations}
  />
);
```

- [ ] **Step 2: Panel — sembunyikan undang/export untuk non-Owner**

Di **`CommitteeAdminSettingsPanel`** import **`viewerMayUseOwnerOnlyCommitteeControls`** dari permisi bank (atau pindahkan helper ke **`roles.ts`** jika Anda ingin pemisahan topik lebih jelas — YAGNI: impor langsung boleh).

```tsx
const canInvite = viewerMayUseOwnerOnlyCommitteeControls(viewerRole);
// if (!canInvite) jangan render Dialog undang beserta blok undangan tertunda
// tautan CSV — bungkus `{canInvite && <Link … export …>}`
```

- [ ] **Step 3: `ManageAdminDialogs` — tombol⋮ Owner-only seperti sekarang atau sembunyikan seluruh menu untuk non-Owner**

Komponen tersebut memanggil aksi **`guardOwner`**. Pengguna yang bukan Owner yang mengklik akan gagal. **Selebihnya UX:** **`if (!canInvite) return null`** di dalam **`ManageAdminDialogs`** **atau** terima prop **`suppressManagementUi`**.

Minimal implementasi bersih untuk non-Owner: **conditional render**:

```tsx
{canInvite ? (
  <ManageAdminDialogs {...} />
) : (
  <span className="text-muted-foreground text-xs">—</span>
)}
```

- [ ] **Step 4: Baris bisa expand** — render sub-komponen **`admin-pic-bank-accounts-inline`**

Gunakan pola state **`expandedAdminProfileId: string | null`** di atas tabel utama; render **dua **`TableRow`** per entri**:

1. **`TableRow`** data utama sama seperti kini + **`Button` “Detail rekening”** yang toggle expand.

2. Jika **`expandedAdminProfileId === row.adminProfileId`**, **`TableRow`** baru dengan **`colSpan={…}`** (hitung **`TableHead`**: saat ini 9 kolom untuk body data + akses kolom baru — sesuaikan; jika Anda menambahkan kolom “Detail”, naikkan colSpan).

`**admin-pic-bank-accounts-inline.tsx`** receives:

```typescript
ownerAdminProfileId: string;
viewerProfileId: string;
viewerRole: AdminRole;
accounts: CommitteeAdminDirectoryRowVm["picBankAccounts"];
manageKey: number;
```

Di dalamnya: daftar kartu/pembagian kecil untuk setiap rekening, dan untuk setiap rekaman **`canMutatePicBankForTarget(viewerRole, viewerProfileId, ownerAdminProfileId)`** bernilai true: form **`update`** (bisa pola dialog **`Dialog`** ringkas sama **`ManageAdminDialogs`**), **`deactivate`** (submit terpisah), **`delete`** (konfirmasi). Untuk rekaman nonaktif, opsi hapus boleh ditampilkan jika Anda ingin mengurangi brak (**YAGNI** — cukup tampilkan status nonaktif + tombol hapus jika **tidak digunakan** atau sembunyikan hapus sampai rekaman menghilang dari daftar aktivasi ulang Anda di iterasi dua).

Gunakan **`useActionState`** serupa blok undangan Anda dan **`toastCudSuccess`** / pola toast error yang sudah dipakai.

- [ ] **Step 5: Form **tambah** rekening** di collapsible yang sama (**hidden input `ownerAdminProfileId`**=`row.adminProfileId`).

- [ ] **Step 6: Setelah berhasil **`create`/`update`/`delete`**, panggil props **`onAnySuccess`** (naik dari panel — sudah ada untuk dialog komite lain) **`+ router.refresh()`** agar SSR ulang **`directory`**.

Panel today:

```tsx
const onManageSuccess = useCallback(() => {
  setManageKey((k) => k + 1);
}, []);
```

Gabung **`router.refresh()`** di callback yang sama (**`committee-admin-settings-panel`**) agar PIC bank baru muncul.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/admin-pic-bank-accounts-inline.tsx src/components/admin/committee-admin-settings-panel.tsx src/app/admin/settings/committee/page.tsx
git commit -m "feat(admin): expandable PIC bank subsection on committee rows"
```

---

### Task 8: Verifikasi integrasi dengan form acara (smoke checklist)

**Files:** (biasanya tanpa ubah kalau **`validatePicBankAndHelpers`** sudah benar)

- [ ] **Step 1: Buka `pnpm dev`; login sebagai Admin**

- [ ] **Step 2: Buat dua rekening untuk satu PIC aktif/nonaktif.**

- [ ] **Step 3:** Nonaktifkan rekening yang dipilih sebuah acara; coba **`Simpan`** form acara — harus gagal pesan **`Rekening tidak milik PIC atau tidak aktif.`** (**`fieldErrors.bankAccountId`**).

Expected: ✅.

- [ ] **Step 4: Commit dokumentasi QA internal** _(opsional)_ — lewati bila Anda tidak dokumentasikan QA.

---

## Self‑review checklist (plan ↔ spec)

1. **Spec coverage**
   - **CRUD-ish via UI subsection per profil** → Tasks 7, 6, 5.
   - **Self / Owner / Admin mutate / Viewer Verifier rule** → Task 3 + 5 + helpers.
   - **Dropdown PIC hanya aktif (`isActive:true`) untuk pilihan** → **`GET /api/admin/pic-banks/...`** & **`events/new`** (query `PicBankAccount` dengan `where: { isActive: true }`) dan **`validatePicBankAndHelpers`** di `admin-events.ts`; Task 8 verifikasi.
   - **Save event blok jika tidak aktif** → sudah ada kode (**`validatePicBankAndHelpers`**); Task 8 memastikan perilaku.
   - **Verifier bisa baca tetapi tidak ada mutasi luar izin & Owner-only undang** → Task 7 + akses routing Task 2.
   - **Hapus hanya kalau tidak dipakai** → **`deletePicBankAccountPermanent`** + **`PIC_BANK_DELETED`** audit.
   - **Nonaktif** → **`deactivatePicBankAccount`** + **`PIC_BANK_DEACTIVATED`** audit.

2. **Placeholder scan**: tidak menggunakan "TBD"; untuk mock Prisma, salin blok **`vi.mock` + rantai pemanggilan** dari **`admin-committee-profiles.test.ts`**.

3. **Type konsistensi**: `AdminRole` sama dengan Prisma/`roles.ts`; nama fungsi konsisten antara **permissions**, **aksi**, dan **komponen**.

---

## Execution handoff

**Plan lengkap dan tersimpan di `docs/superpowers/plans/2026-05-04-pengaturan-rekening-pic.md`.** Dua opsi eksekusi:

1. **Subagent‑Driven (disarankan)** — satu sub‑agen per tugas besar (Task); review antar tugas untuk menjaga konsistensi layout App Router Anda.

2. **Inline Execution** — kerjakan tugas secara beruntun dalam sesi Cursor yang sama dengan checkpoint setelah komit Task 6–7 (UI).

**Mana yang Anda pilih?**
