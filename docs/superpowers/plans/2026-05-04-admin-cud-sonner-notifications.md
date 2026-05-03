# Notifikasi CUD (Sonner) — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menetapkan gaya dasar toast Sonner yang selaras dengan tema shadcn/Tailwind aplikasi, lalu menampilkan notifikasi konsisten (sukses/gagal) untuk setiap operasi Create, Update, Delete yang memanggil Server Action dan mengembalikan `ActionResult<T>`.

**Architecture:** Tetap di sisi klien (`"use client"`): panggil `toast` dari `sonner` setelah `ActionResult` diketahui. Sisipkan satu modul pembantu agar pesan default berbahasa Indonesia dan penanganan gagal seragam (`rootError` + `fieldErrors`). Gaya visual memperkuat kelas `cn-toast` pada `toastOptions` yang sudah ada di `src/components/ui/sonner.tsx` plus aturan di `globals.css`. Komponen dengan `useTransition` memanggil pembantu di cabang `result.ok` / `!result.ok`. Komponen dengan `useActionState` yang sudah menampilkan `Alert` mendapat **toast sukses saja** (`useEffect` memantau `state`); kegagalan tetap lewat `Alert` agar tidak menduplikasi noise. **Tidak dalam cakupan:** alur autentikasi (`admin-sign-in-client`, 2FA) karena bukan mutasi data domain.

**Tech Stack:** Next.js App Router, React 19, Sonner 2.x, shadcn/ui (`Toaster`), Tailwind v4, Vitest.

---

## Peta file (struktur)

| File | Tanggung jawab |
|------|----------------|
| `src/lib/forms/format-action-error-message.ts` | Fungsi murni: rangkai pesan gagal dari `ActionErr` (aman diimpor dari tes tanpa `sonner`). |
| `src/lib/forms/format-action-error-message.test.ts` | Tes unit perilaku format pesan. |
| `src/lib/client/cud-notify.ts` | `"use client"` — `toastCudSuccess`, `toastActionErr`, re-export message formatter jika perlu. |
| `src/app/globals.css` | Gaya `.cn-toast` dan penyesuaian `.toaster`/wrapper agar konsisten dengan design token. |
| `src/components/ui/sonner.tsx` | Opsional: `duration`, `closeButton`, kelas tambahan pada `toastOptions.classNames`. |
| Daftar ~24 komponen TSX di bawah | Panggilan pembantu setelah aksi server. |

**Komponen yang memanggil `@/lib/actions/*` (harus dapat notifikasi CUD):**

1. `src/components/public/registration-form/registration-form.tsx` — create pendaftaran.
2. `src/components/admin/forms/event-admin-form.tsx` — create/update acara.
3. `src/components/admin/event-delete-panel.tsx` — delete acara.
4. `src/components/admin/member-form-dialog.tsx` — create/update anggota master.
5. `src/components/admin/member-delete-dialog.tsx` — delete anggota master.
6. `src/components/admin/member-csv-import-panel.tsx` — impor massal (ciptaan).
7. `src/components/admin/management-member-form-dialog.tsx` — CUD pengurus.
8. `src/components/admin/management-assignment-form-dialog.tsx` — CUD penugasan dewan.
9. `src/components/admin/management-period-form-dialog.tsx` — CUD periode dewan.
10. `src/components/admin/management-role-form-dialog.tsx` — CUD jabatan dewan.
11. `src/components/admin/registration-actions.tsx` — approve / reject / payment issue (mutasi status pendaftaran).
12. `src/components/admin/attendance-panel.tsx` — update kehadiran.
13. `src/components/admin/member-validation-panel.tsx` — update validasi anggota.
14. `src/components/admin/cancel-refund-panel.tsx` — cancel/refund.
15. `src/components/admin/voucher-redemption-panel.tsx` — redeem (update).
16. `src/components/admin/invoice-adjustment-panel.tsx` — create adjustment, mark paid/unpaid, upload bukti.
17. `src/components/admin/club-branding-settings-form.tsx` — update (useActionState).
18. `src/components/admin/club-operational-settings-form.tsx` — update.
19. `src/components/admin/club-notification-preferences-form.tsx` — update.
20. `src/components/admin/committee-default-pricing-form.tsx` — update.
21. `src/components/admin/club-wa-templates-panel.tsx` — simpan / reset template.
22. `src/components/admin/committee-admin-settings-panel.tsx` — add/update/revoke/delete admin komite.
23. `src/components/admin/admin-account-page-client.tsx` — update nama tampilan.

---

### Task 1: Formatter pesan gagal (TDD)

**Files:**

- Create: `src/lib/forms/format-action-error-message.ts`
- Create: `src/lib/forms/format-action-error-message.test.ts`

- [ ] **Step 1: Buat modul murni**

```typescript
import type { ActionErr } from "@/lib/forms/action-result";

/**
 * Merangkum ActionErr menjadi satu string untuk toast atau log.
 * Urutan: rootError → gabungan fieldErrors → fallback.
 */
export function formatActionErrorMessage(
  err: ActionErr,
  fallback = "Terjadi kesalahan.",
): string {
  if (err.rootError?.trim()) return err.rootError.trim();
  const fe = err.fieldErrors;
  if (fe && Object.keys(fe).length > 0) {
    return Object.entries(fe)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
  }
  return fallback;
}
```

- [ ] **Step 2: Tulis tes yang gagal dulu**

```typescript
import { describe, expect, it } from "vitest";

import type { ActionErr } from "@/lib/forms/action-result";
import { formatActionErrorMessage } from "@/lib/forms/format-action-error-message";

describe("formatActionErrorMessage", () => {
  it("prefers rootError over fieldErrors", () => {
    const err: ActionErr = {
      ok: false,
      rootError: "Tidak diizinkan.",
      fieldErrors: { email: "Invalid" },
    };
    expect(formatActionErrorMessage(err)).toBe("Tidak diizinkan.");
  });

  it("joins fieldErrors when rootError absent", () => {
    const err: ActionErr = {
      ok: false,
      fieldErrors: { a: "satu", b: "dua" },
    };
    expect(formatActionErrorMessage(err)).toBe("a: satu · b: dua");
  });

  it("uses fallback when empty err", () => {
    expect(formatActionErrorMessage({ ok: false })).toBe("Terjadi kesalahan.");
    expect(formatActionErrorMessage({ ok: false }, "Fallback khusus")).toBe(
      "Fallback khusus",
    );
  });
});
```

- [ ] **Step 3: Jalankan tes hingga PASS**

Run:

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/forms/format-action-error-message.test.ts --reporter=verbose
```

Expected: exit code 0; 3 tests passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/forms/format-action-error-message.ts src/lib/forms/format-action-error-message.test.ts
git commit -m "feat(forms): add ActionErr message formatter with tests"
```

---

### Task 2: Pembantu klien `toastCudSuccess` / `toastActionErr`

**Files:**

- Create: `src/lib/client/cud-notify.ts`

- [ ] **Step 1: Implementasi**

```typescript
"use client";

import { toast } from "sonner";

import type { ActionErr } from "@/lib/forms/action-result";
import { formatActionErrorMessage } from "@/lib/forms/format-action-error-message";

export type CudOperation = "create" | "update" | "delete";

const DEFAULT_SUCCESS: Record<CudOperation, string> = {
  create: "Data berhasil ditambahkan.",
  update: "Data berhasil diperbarui.",
  delete: "Data berhasil dihapus.",
};

/** Toast sukses CUD. Gunakan explicitMessage untuk konteks singkat (judul tetap bahasa Indonesia). */
export function toastCudSuccess(
  operation: CudOperation,
  explicitMessage?: string,
): void {
  toast.success(explicitMessage ?? DEFAULT_SUCCESS[operation]);
}

/** Toast gagal untuk sembarang ActionErr (setelah pemeriksaan !result.ok). */
export function toastActionErr(err: ActionErr, fallback?: string): void {
  toast.error(formatActionErrorMessage(err, fallback ?? "Terjadi kesalahan."));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/client/cud-notify.ts
git commit -m "feat(ui): add client CUD toast helpers for Sonner"
```

---

### Task 3: Gaya dasar toast (`globals.css` + penyempurnaan `sonner.tsx`)

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/components/ui/sonner.tsx`

- [ ] **Step 1: Tambahkan layer components di akhir `globals.css`**

```css
@layer components {
  /* Sonner: kelas pada setiap toast (lihat toastOptions.classNames di sonner.tsx) */
  .cn-toast {
    @apply gap-3 border font-sans text-sm shadow-md;
  }

  .cn-toast [data-title] {
    @apply font-medium leading-snug;
  }

  .cn-toast [data-description] {
    @apply text-muted-foreground text-xs leading-relaxed;
  }

  /* Container toaster: sedikit jarak dari tepi viewport */
  .toaster.group {
    @apply [--width:22rem] sm:[--width:24rem];
  }
}
```

- [ ] **Step 2: Perkaya `Sonner` di `sonner.tsx`**

Di dalam `<Sonner ...>`, set properti berikut (gabungkan dengan spread `props` yang ada):

```tsx
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          title: "text-foreground",
          description: "text-muted-foreground",
          actionButton: "text-primary",
          cancelButton: "text-muted-foreground",
        },
      }}
```

Hapus duplikasi `toastOptions` lama bertipe singleton jika bertabrakan — **satu** objek `toastOptions` yang memuat `classNames` di atas.

- [ ] **Step 3: Verifikasi build/lint cepat**

Run:

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint
```

Expected: ESLint bersih untuk file yang disentuh.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/ui/sonner.tsx
git commit -m "style(ui): base Sonner toast tokens and toaster options"
```

---

### Task 4: Form publik — pendaftaran acara (Create)

**Files:**

- Modify: `src/components/public/registration-form/registration-form.tsx`

- [ ] **Step 1: Impor pembantu**

```typescript
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
```

- [ ] **Step 2: Setelah submit sukses, toast lalu navigasi**

Di dalam handler setelah `const result = await submitRegistration(...)`, pada cabang `if (result.ok) {`:

```typescript
      toastCudSuccess("create", "Pendaftaran berhasil dikirim.");
      router.push(
        `/events/${event.slug}/register/${result.data.registrationId}`,
      );
```

- [ ] **Step 3: Pada cabang gagal**, sebelum atau sesudah `form.setError`, panggil:

```typescript
    toastActionErr(result);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/public/registration-form/registration-form.tsx
git commit -m "feat(registration): sonner CUD feedback on submit"
```

---

### Task 5: Acara admin — Create / Update / Delete

**Files:**

- Modify: `src/components/admin/forms/event-admin-form.tsx`
- Modify: `src/components/admin/event-delete-panel.tsx`

- [ ] **Step 1: `event-admin-form.tsx`**

Impor:

```typescript
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
```

Mencari panggilan `createAdminEvent` / `updateAdminEvent` di dalam `startTransition`. Jika `result.ok`, panggil:

- Acara baru: `toastCudSuccess("create", "Acara berhasil dibuat.");`
- Edit: `toastCudSuccess("update", "Acara berhasil diperbarui.");`

Jika `!result.ok`, panggil `toastActionErr(result)` (tetap pertahankan `setRootMessage` / alur sensitif yang sudah ada).

- [ ] **Step 2: `event-delete-panel.tsx`**

Impor `toastCudSuccess` dan `toastActionErr`. Di `useEffect` yang memantau `state?.ok` untuk redirect, tambahkan sebelum `router`:

```typescript
      toastCudSuccess("delete", "Acara berhasil dihapus.");
```

Tambahkan `useEffect` terpisah:

```typescript
  useEffect(() => {
    if (state?.ok === false) toastActionErr(state);
  }, [state]);
```

(Hindari double-toast sukses: hanya toast sukses di cabang yang sama dengan redirect yang sudah ada.)

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/forms/event-admin-form.tsx src/components/admin/event-delete-panel.tsx
git commit -m "feat(admin-events): sonner feedback for event CUD"
```

---

### Task 6: Direktori anggota master — Create / Update / Delete / impor CSV

**Files:**

- Modify: `src/components/admin/member-form-dialog.tsx`
- Modify: `src/components/admin/member-delete-dialog.tsx`
- Modify: `src/components/admin/member-csv-import-panel.tsx`

- [ ] **Step 1: Pola umum**

Impor:

```typescript
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
```

- [ ] **Step 2: `member-form-dialog.tsx`**

Pada hasil simpan: jika mode tambah → `toastCudSuccess("create", "Anggota berhasil ditambahkan.");` jika edit → `toastCudSuccess("update", "Anggota berhasil diperbarui.");`

Pada `!result.ok`: `toastActionErr(result)` (dialog biasanya menampilkan error inline — dua saluran ini sengaja).

- [ ] **Step 3: `member-delete-dialog.tsx`**

Pada `result.ok`: `toastCudSuccess("delete", "Anggota berhasil dihapus.");`

Pada gagal: `toastActionErr(result)`.

- [ ] **Step 4: `member-csv-import-panel.tsx`**

Pada `result.ok`: `toastCudSuccess("create", "Import CSV berhasil.");` atau pesan lain dari konteks (`result.data` jika ada jumlah baris — tetap bahasa Indonesia).

Pada gagal: `toastActionErr(result)`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/member-form-dialog.tsx src/components/admin/member-delete-dialog.tsx src/components/admin/member-csv-import-panel.tsx
git commit -m "feat(admin-members): sonner CUD feedback for master directory"
```

---

### Task 7: Struktur organ — dewan & jabatan (empat dialog)

**Files:**

- Modify: `src/components/admin/management-member-form-dialog.tsx`
- Modify: `src/components/admin/management-assignment-form-dialog.tsx`
- Modify: `src/components/admin/management-period-form-dialog.tsx`
- Modify: `src/components/admin/management-role-form-dialog.tsx`

- [ ] **Step 1:** Impor `toastActionErr`, `toastCudSuccess`.

- [ ] **Step 2:** Untuk setiap handler simpan baru vs edit gunakan `"create"` / `"update"` dengan pesan eksplisit bermakna:

  - Pengurus: "Pengurus berhasil ditambahkan." / diperbarui.
  - Penugasan: "Penugasan berhasil ditambahkan." / diperbarui.
  - Periode: "Periode berhasil ditambahkan." / diperbarui.
  - Jabatan: "Jabatan berhasil ditambahkan." / diperbarui.

- [ ] **Step 3:** Untuk nonaktif/hapus (jika menghasilkan hapus lunak/permanen sesuai aksi backend) gunakan `toastCudSuccess("delete", ...)` atau `toastCudSuccess("update", ...)` jika sekadar menonaktifkan — sesuaikan dengan kopi UI yang ada hari ini; yang penting konsisten antara label tombol dan jenis toast.

- [ ] **Step 4:** Pada setiap cabang kesalahan reducers/form: `toastActionErr` dengan `ActionErr`-kompatibel (objek dengan `ok: false`).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/management-member-form-dialog.tsx src/components/admin/management-assignment-form-dialog.tsx src/components/admin/management-period-form-dialog.tsx src/components/admin/management-role-form-dialog.tsx
git commit -m "feat(org): sonner CUD feedback for board management dialogs"
```

---

### Task 8: Alur pendaftaran di admin (verifikasi, kehadiran, pembatalan, voucher, validasi, invoice)

**Files:**

- Modify: `src/components/admin/registration-actions.tsx`
- Modify: `src/components/admin/attendance-panel.tsx`
- Modify: `src/components/admin/member-validation-panel.tsx`
- Modify: `src/components/admin/cancel-refund-panel.tsx`
- Modify: `src/components/admin/voucher-redemption-panel.tsx`
- Modify: `src/components/admin/invoice-adjustment-panel.tsx`

- [ ] **Step 1: `registration-actions.tsx`**

Impor pembantu. Pada sukses:

- Approve: `toastCudSuccess("update", "Pendaftaran disetujui.");`
- Reject: `toastCudSuccess("update", "Pendaftaran ditolak.");`
- Payment issue: `toastCudSuccess("update", "Status pembayaran diperbarui.");`

Pada `!result.ok`: `toastActionErr(result)`.

- [ ] **Step 2: `attendance-panel.tsx`**

Sukses: `toastCudSuccess("update", "Kehadiran diperbarui.");`  
Gagal: `toastActionErr(result)`.

- [ ] **Step 3: `member-validation-panel.tsx`**

Sukses: `toastCudSuccess("update", "Validasi anggota disimpan.");`  
Gagal: `toastActionErr(res)`.

- [ ] **Step 4: `cancel-refund-panel.tsx`**

Sukses cancel: `toastCudSuccess("update", "Pendaftaran dibatalkan.");`  
Sukses refund: `toastCudSuccess("update", "Pengembalian dana dicatat.");`  
Gagal: `toastActionErr(result)`.

- [ ] **Step 5: `voucher-redemption-panel.tsx`**

Sukses: `toastCudSuccess("update", "Voucher berhasil ditukar.");`  
Gagal: `toastActionErr(result)`.

- [ ] **Step 6: `invoice-adjustment-panel.tsx`**

- `handleCreate` sukses: `toastCudSuccess("create", "Penyesuaian invoice ditambahkan.");`
- `handleMarkPaid` sukses: `toastCudSuccess("update", "Penyesuaian ditandai lunas.");`
- `handleMarkUnpaid` sukses: `toastCudSuccess("update", "Penyesuaian ditandai belum lunas.");`
- `handleUploadProof` sukses: `toastCudSuccess("update", "Bukti penyesuaian diunggah.");`
- Semua gagal: `toastActionErr(result)`.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/registration-actions.tsx src/components/admin/attendance-panel.tsx src/components/admin/member-validation-panel.tsx src/components/admin/cancel-refund-panel.tsx src/components/admin/voucher-redemption-panel.tsx src/components/admin/invoice-adjustment-panel.tsx
git commit -m "feat(admin-inbox): sonner feedback for registration mutations"
```

---

### Task 9: Form klub & komite (`useActionState`) — toast sukses + biarkan Alert untuk error

**Files:**

- Modify: `src/components/admin/club-branding-settings-form.tsx`
- Modify: `src/components/admin/club-operational-settings-form.tsx`
- Modify: `src/components/admin/club-notification-preferences-form.tsx`
- Modify: `src/components/admin/committee-default-pricing-form.tsx`
- Modify: `src/components/admin/club-wa-templates-panel.tsx`
- Modify: `src/components/admin/committee-admin-settings-panel.tsx`

- [ ] **Step 1: Impor di setiap file**

```typescript
import { useEffect } from "react";
import { toastCudSuccess } from "@/lib/client/cud-notify";
```

(If `useEffect` already imported, merge import line.)

- [ ] **Step 2: Pola untuk form berstatus tunggal** (branding, operational, notification, default pricing)

Tambahkan:

```typescript
  useEffect(() => {
    if (state?.ok) {
      toastCudSuccess("update", "Pengaturan berhasil disimpan.");
    }
  }, [state]);
```

Sesuaikan frasa jika perlu (mis. "Harga default disimpan." di `committee-default-pricing-form.tsx`).

- [ ] **Step 3: `club-wa-templates-panel.tsx`**

Dua `useActionState` (`saveState`, `resetState`). Dua efek:

```typescript
  useEffect(() => {
    if (saveState?.ok) toastCudSuccess("update", "Template WA disimpan.");
  }, [saveState]);

  useEffect(() => {
    if (resetState?.ok) toastCudSuccess("update", "Template WA dikembalikan ke default.");
  }, [resetState]);
```

- [ ] **Step 4: `committee-admin-settings-panel.tsx`**

Di `ManageAdminDialogs`, tambahkan empat efek memantau `roleState`, `memberState`, `revokeState`, `deleteState` masing-masing:

```typescript
  useEffect(() => {
    if (roleState?.ok) toastCudSuccess("update", "Peran admin diperbarui.");
  }, [roleState]);

  useEffect(() => {
    if (memberState?.ok) toastCudSuccess("update", "Tautan anggota admin diperbarui.");
  }, [memberState]);

  useEffect(() => {
    if (revokeState?.ok) toastCudSuccess("update", "Akses admin dicabut.");
  }, [revokeState]);

  useEffect(() => {
    if (deleteState?.ok) toastCudSuccess("delete", "Admin komite dihapus.");
  }, [deleteState]);
```

Untuk `addCommitteeAdminByEmail` (state `addState` di bagian bawah file), efek serupa: `toastCudSuccess("create", "Admin komite ditambahkan.");`

Jangan panggil `toastActionErr` di sini agar tidak dobel dengan `Alert`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/club-branding-settings-form.tsx src/components/admin/club-operational-settings-form.tsx src/components/admin/club-notification-preferences-form.tsx src/components/admin/committee-default-pricing-form.tsx src/components/admin/club-wa-templates-panel.tsx src/components/admin/committee-admin-settings-panel.tsx
git commit -m "feat(admin-settings): sonner success toasts for club and committee forms"
```

---

### Task 10: Akun admin — update nama tampilan

**Files:**

- Modify: `src/components/admin/admin-account-page-client.tsx`

- [ ] **Step 1:** Impor `toastActionErr`, `toastCudSuccess`.

- [ ] **Step 2:** Di dalam `startTransition` setelah `updateAdminDisplayName`, jika `res.ok` → `toastCudSuccess("update", "Nama tampilan diperbarui.");`  
  jika `!res.ok` → `toastActionErr(res)` (tetap biarkan `form.setError`).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/admin-account-page-client.tsx
git commit -m "feat(admin-account): sonner feedback for display name update"
```

---

### Task 11: Verifikasi akhir

- [ ] **Step 1: Unit tests**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm test
```

Expected: semua tes lulus.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: tanpa error pada file yang diubah.

- [ ] **Step 3: Manual smoke (dev)**

```bash
pnpm dev
```

Uji minimal: simpan branding, buat penyesuaian invoice, submit pendaftaran test — pastikan toast muncul dan tema terang/gelap konsisten.

- [ ] **Step 4: Commit** (hanya jika ada perbaikan dari verifikasi)

---

## Self-review (penulis rencana)

**1. Spec coverage:** Gaya dasar (Task 3) + integrasi pada semua pemanggil `ActionResult` dari `@/lib/actions/*` di TSX tercatat; alur auth sengaja di luar cakupan.

**2. Placeholder scan:** Tidak ada TBD; setiap task memuat cuplikan kode konkret.

**3. Type consistency:** `ActionErr` dan `ActionResult<T>` mengikuti `src/lib/forms/action-result.ts`; impor memakai alias `@/`.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-04-admin-cud-sonner-notifications.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch subagent segar per task, review antar task, iterasi cepat (REQUIRED SUB-SKILL: superpowers:subagent-driven-development).

**2. Inline Execution** — jalankan task dalam sesi ini dengan checkpoint (REQUIRED SUB-SKILL: superpowers:executing-plans).

**Which approach?**
