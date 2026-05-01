# Admin Settings Phase C — Operations Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mempersistensi **pengaturan operasional klub** (singleton Postgres): *(1)* penutupan **pendaftaran publik secara global** dengan pesan kustom atau salinan baku, *(2)* **banner peringatan/perawatan** teks polos di seluruh `**(public)**`; serta **titik percabangan teruji** di server saat penyimpanan pendaftaran.

**Architecture:** Mengikuti pola **Phase A/B**: model **singleton** Prisma satu baris (bukan satu JSON tidak terstruktur), key stabil `singletonKey === "default"`, pembaca publik **`React.cache`** di `**/lib/public/**`, mutasi **`guardOwner`** + **`ActionResult`** + Zod seperti `**/admin-club-branding.ts**`. Penggabungan “apakah registrasi dibuka untuk pengunjung” dilakukan di **helper murni** yang diuji Vitest lalu dipakai di **`getSerializedEventForPublicRegistration`** dan **cek awal `submitRegistration`** (serangan tidak bisa mem‑bypass dengan FormData palsu).

**Tech Stack:** Next.js App Router, Prisma + migrasi Postgres, Vitest (`pnpm vitest run`), Server Actions `"use server"`, `useActionState` pada form pengaturan (jangan pakai `<form action={serverFn}>` langsung untuk aksi yang mengembalikan `ActionResult`; ikuti **`club-wa-templates-panel.tsx`**).

**Explicitly deferring (Phase D §5.5 spek):** **audit log append-only** untuk perubahan flag operasional — tidak ada tabel audit pada Phase C ini; dokumentasikan dalam PR satu baris “audit mengikuti Phase D”.

**Normative references:** [`docs/superpowers/specs/2026-05-02-admin-settings-modules-design.md`](../specs/2026-05-02-admin-settings-modules-design.md) §5.4, §7 baris Phase C.

---

## File map — penciptaan & tanggung jawab

| File | Tanggung jawab |
|------|----------------|
| `prisma/schema.prisma` | Model `ClubOperationalSettings` singleton (kolom eksplisit per perilaku, spek §5.4). |
| `prisma/migrations/*/` | DDL dari `pnpm prisma migrate dev`. |
| `src/lib/public/club-operational-policy.ts` | Konstanta pesan baku + **`mergeGlobalRegistrationClosure`** + **`effectiveMaintenanceBanner`** (murni, terdokumentasi satu kalimat perilaku tiap perilaku cabang). |
| `src/lib/public/club-operational-policy.test.ts` | Vitest: buka → tutup global, tetap tertutup bila event sudah tutup, banner null/trim. |
| `src/lib/public/load-club-operational-settings.ts` | `cache()` + `prisma`; export `CLUB_OPERATIONAL_SINGLETON_KEY`; fallback bila row belum ada. |
| `src/lib/forms/club-operational-settings-schema.ts` | Zod: boolean dari checkbox FormData + dua string opsional dibatasi panjang. |
| `src/lib/actions/admin-club-operational-settings.ts` | `saveClubOperationalSettings(_prev, fd)` Owner-only, upsert singleton, **`revalidatePath`**. |
| `src/components/admin/club-operational-settings-form.tsx` | Klien: `useActionState`, Checkbox + Textarea untuk pesan tutup global + textarea banner (polos); teks ditampilkan sebagai string biasa tanpa markup. |
| `src/app/admin/settings/operations/page.tsx` | Ganti placeholder: RSC prefetch baris atau default. |
| `src/app/admin/settings/page.tsx` | Update deskripsi kartu **Operasional** (hilangkan “Menyusul…” bila ada). |
| `src/lib/events/event-registration-page.ts` | Gabungkan hasil `registrationOpen`/`registrationClosedMessage` dengan flag global. |
| `src/lib/actions/submit-registration.ts` | Guard setelah event aktif diketahui memakai **muatan singleton yang sama** (satu lookup DB konsisten dengan halaman publik). |
| `src/app/(public)/layout.tsx` | Jika banner efektif non-null → `Alert` antara header dan konten (atau tepat di bawah header). |

---

## Perilaku produk yang di-lock (implementor jangan improvisasi nama sembarangan)

| Kolom DB / nama konsep | Nama stabil di schema | Pengaruh aplikasi |
|------------------------|------------------------|-------------------|
| `registrationGloballyDisabled` | kolom Boolean `@default(false)` | Jika `true`: **`registrationOpen` dipaksa `false`** di serialisasi acara publik; **`submitRegistration` mengembalikan `rootError`** dengan pesan yang sama seperti yang dilihat pengunjung jika bisa (kustom atau baku). |
| `globalRegistrationClosedMessage` | `String?` | Hanya dipakai jika `registrationGloballyDisabled === true`; jika `null` atau string kosong setelah trim, pakai **`DEFAULT_GLOBAL_REGISTRATION_CLOSED`** di `club-operational-policy.ts`. |
| `maintenanceBannerPlainText` | `String?` | Jika setelah **`effectiveMaintenanceBanner`** hasilnya non-null, **layout publik menampilkan `<Alert>`** dengan teks tersebut sebagai **teks biasa di `AlertDescription`** (tidak memparsing markup). |

**Teks baku cadangan tunggal (wajib persis dalam kode pertama; tes mengunci string ini):**

```
Sementara waktu pendaftaran acara ditutup sementara oleh pengurus. Silakan coba lagi nanti.
```

---

### Task 1: Prisma `ClubOperationalSettings` + migrasi

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<stamp>_club_operational_settings/migration.sql` (hasil CLI)

Sisipkan model (penempatan dekat singleton lain seperti `ClubBranding`/`CommitteeTicketDefaults` agar reviewer mudah):

```prisma
/// Operational toggles untuk seluruh situs publik. Singleton key tetap — lihat loader `loadClubOperationalSettings`.
model ClubOperationalSettings {
  singletonKey                     String   @id
  registrationGloballyDisabled     Boolean  @default(false)
  globalRegistrationClosedMessage String?
  maintenanceBannerPlainText      String?
  createdAt                        DateTime @default(now())
  updatedAt                        DateTime @updatedAt
}
```

- [ ] **Step 1:** Tempel model; pastikan tidak bentrok nama dengan model lain.
- [ ] **Step 2: Migrasi development**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm prisma migrate dev --name club_operational_settings
```

Expected: migrasi berhasil tanpa dry-run error.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): club operational settings singleton"
```

---

### Task 2: Kebijakan murni + tes (TDD)

**Files:**
- Create: `src/lib/public/club-operational-policy.ts`
- Create: `src/lib/public/club-operational-policy.test.ts`

- [ ] **Step 1: Tulis tes dulu**

```typescript
import { describe, expect, it } from "vitest";

import {
  DEFAULT_GLOBAL_REGISTRATION_CLOSED,
  effectiveMaintenanceBanner,
  mergeGlobalRegistrationClosure,
} from "./club-operational-policy";

describe("mergeGlobalRegistrationClosure", () => {
  it("meneruskan event terbuka bila penutupan global tidak aktif", () => {
    expect(
      mergeGlobalRegistrationClosure({
        registrationOpen: true,
        registrationClosedMessage: null,
        registrationGloballyDisabled: false,
        globalRegistrationClosedMessage: null,
      }),
    ).toEqual({ registrationOpen: true, registrationClosedMessage: null });
  });

  it("memaksa tutup ketika penutupan global aktif walau event terbuka", () => {
    expect(
      mergeGlobalRegistrationClosure({
        registrationOpen: true,
        registrationClosedMessage: null,
        registrationGloballyDisabled: true,
        globalRegistrationClosedMessage: "Libur kolektif.",
      }),
    ).toEqual({
      registrationOpen: false,
      registrationClosedMessage: "Libur kolektif.",
    });
  });

  it("memakai salinan DEFAULT jika pesan global kosong tetapi penutupan aktif", () => {
    expect(
      mergeGlobalRegistrationClosure({
        registrationOpen: true,
        registrationClosedMessage: null,
        registrationGloballyDisabled: true,
        globalRegistrationClosedMessage: "   ",
      }).registrationClosedMessage,
    ).toBe(DEFAULT_GLOBAL_REGISTRATION_CLOSED);
  });

  it("tetap menutup bila event sudah tertutup sebelumnya", () => {
    expect(
      mergeGlobalRegistrationClosure({
        registrationOpen: false,
        registrationClosedMessage: "Kuota habis.",
        registrationGloballyDisabled: true,
        globalRegistrationClosedMessage: null,
      }),
    ).toEqual({
      registrationOpen: false,
      registrationClosedMessage: DEFAULT_GLOBAL_REGISTRATION_CLOSED,
    });
  });
});

describe("effectiveMaintenanceBanner", () => {
  it("menghasilkan null untuk null atau hanya whitespace", () => {
    expect(effectiveMaintenanceBanner(null)).toBeNull();
    expect(effectiveMaintenanceBanner("  ")).toBeNull();
  });

  it("mempertahankan teks tidak kosong ter-trim", () => {
    expect(effectiveMaintenanceBanner("  Peringatan tes  ")).toBe("Peringatan tes");
  });
});
```

- [ ] **Step 2: Jalankan tes — harus gagal**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/public/club-operational-policy.test.ts
```

Expected: FAIL module not found atau export missing.

- [ ] **Step 3: Implementasi minimal**

```typescript
/** Pesan pengunjung bila pengurus menutup pendaftaran seluruh situs tanpa mengisi pesan kustom. */
export const DEFAULT_GLOBAL_REGISTRATION_CLOSED =
  "Sementara waktu pendaftaran acara ditutup sementara oleh pengurus. Silakan coba lagi nanti.";

/**
 * Menggabungkan apakah alur registrasi umum bisa dilanjutkan di UI untuk satu acara,
 * dengan prioritas tertinggi pada penutupan global komite (`registrationGloballyDisabled`).
 */
export function mergeGlobalRegistrationClosure(args: {
  registrationOpen: boolean;
  registrationClosedMessage: string | null;
  registrationGloballyDisabled: boolean;
  globalRegistrationClosedMessage: string | null;
}): {
  registrationOpen: boolean;
  registrationClosedMessage: string | null;
} {
  if (!args.registrationGloballyDisabled) {
    return {
      registrationOpen: args.registrationOpen,
      registrationClosedMessage: args.registrationClosedMessage,
    };
  }
  const trimmed = args.globalRegistrationClosedMessage?.trim() ?? "";
  const msg = trimmed !== "" ? trimmed : DEFAULT_GLOBAL_REGISTRATION_CLOSED;
  return { registrationOpen: false, registrationClosedMessage: msg };
}

/** Banner publik: null berarti tidak menampilkan alert. Teks dipakai apa adanya. */
export function effectiveMaintenanceBanner(
  plain: string | null | undefined,
): string | null {
  if (plain == null) return null;
  const t = plain.trim();
  return t === "" ? null : t;
}
```

- [ ] **Step 4: Jalankan tes — harus lulus**

```bash
pnpm vitest run src/lib/public/club-operational-policy.test.ts
```

Expected: semua tes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/public/club-operational-policy.ts src/lib/public/club-operational-policy.test.ts
git commit -m "feat(ops): operational registration merge policy with tests"
```

---

### Task 3: Loader `React.cache` + VM publik

**Files:**
- Create: `src/lib/public/load-club-operational-settings.ts`

- [ ] **Step 1:** Implementasi berikut:

```typescript
import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export const CLUB_OPERATIONAL_SINGLETON_KEY = "default" as const;

export type ClubOperationalVm = {
  registrationGloballyDisabled: boolean;
  globalRegistrationClosedMessage: string | null;
  maintenanceBannerPlainText: string | null;
};

export const loadClubOperationalSettings = cache(
  async (): Promise<ClubOperationalVm> => {
    const row = await prisma.clubOperationalSettings.findUnique({
      where: { singletonKey: CLUB_OPERATIONAL_SINGLETON_KEY },
    });
    return {
      registrationGloballyDisabled: row?.registrationGloballyDisabled ?? false,
      globalRegistrationClosedMessage:
        row?.globalRegistrationClosedMessage ?? null,
      maintenanceBannerPlainText: row?.maintenanceBannerPlainText ?? null,
    };
  },
);
```

- [ ] **Step 2:** Setelah **`pnpm prisma generate`**, jalankan `pnpm exec tsc --noEmit` atau `pnpm build` untuk memastikan nama model prisma cocok.

- [ ] **Step 3: Commit**

```bash
git add src/lib/public/load-club-operational-settings.ts
git commit -m "feat(ops): cached loader for operational settings"
```

---

### Task 4: Sematkan penggabungan ke data acara publik

**Files:**
- Modify: `src/lib/events/event-registration-page.ts`

- [ ] **Step 1:** Setelah Anda menghitung `registrationOpen`, `registrationClosedMessage` seperti hari ini, impor **`loadClubOperationalSettings`** dari loader baru dan **`mergeGlobalRegistrationClosure`** dari **`club-operational-policy`**.

- [ ] **Step 2:** Panggil `await loadClubOperationalSettings()` sekali dalam `getSerializedEventForPublicRegistration` (di dalam pengclosure `cache`-nya), gabungkan hasilnya:

```typescript
const ops = await loadClubOperationalSettings();
const merged = mergeGlobalRegistrationClosure({
  registrationOpen,
  registrationClosedMessage,
  registrationGloballyDisabled: ops.registrationGloballyDisabled,
  globalRegistrationClosedMessage: ops.globalRegistrationClosedMessage,
});
registrationOpen = merged.registrationOpen;
registrationClosedMessage = merged.registrationClosedMessage;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/events/event-registration-page.ts
git commit -m "feat(public): honor global registration closure in event serialization"
```

---

### Task 5: Guard server `submitRegistration`

**Files:**
- Modify: `src/lib/actions/submit-registration.ts`

- [ ] **Step 1:** Setelah blok “event tidak ditemukan”, setelah Anda punya **`event`** aktif tetapi **sebelum transaksi utama**, impor **`loadClubOperationalSettings`**, **`mergeGlobalRegistrationClosure`**, **`registrationBlockMessageForPublic`**, **`isRegistrationOpenForEvent`** (berapa pun yang sudah ada file ini), serta **`DEFAULT_GLOBAL_REGISTRATION_CLOSED`**.

```typescript
import { loadClubOperationalSettings } from "@/lib/public/load-club-operational-settings";
import {
  mergeGlobalRegistrationClosure,
  DEFAULT_GLOBAL_REGISTRATION_CLOSED,
} from "@/lib/public/club-operational-policy";
```

- [ ] **Step 2:** Bangun gabungan menggunakan **hitungan kuota yang sama** dengan validasi Anda saat ini (variabel seperti `registrationsTowardQuotaPreview` di file Anda):

```typescript
const opsGate = await loadClubOperationalSettings();
const locallyOpen = isRegistrationOpenForEvent({
  event,
  registrationsTowardQuota: registrationsTowardQuotaPreview,
});
const mergedGate = mergeGlobalRegistrationClosure({
  registrationOpen: locallyOpen,
  registrationClosedMessage: locallyOpen
    ? null
    : registrationBlockMessageForPublic({
        eventStatus: event.status,
        registrationManualClosed: event.registrationManualClosed,
        registrationCapacity: event.registrationCapacity,
        registrationsTowardQuota: registrationsTowardQuotaPreview,
      }),
  registrationGloballyDisabled: opsGate.registrationGloballyDisabled,
  globalRegistrationClosedMessage: opsGate.globalRegistrationClosedMessage,
});

if (!mergedGate.registrationOpen) {
  return rootError(
    mergedGate.registrationClosedMessage ??
      DEFAULT_GLOBAL_REGISTRATION_CLOSED,
  );
}
```

- [ ] **Step 3:** Pastikan blok ini diletakkan **sebelum komputasi harga besar** atau unggahan — gagal cepat tetapi setelah Anda memverifikasi acara ada.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/submit-registration.ts
git commit -m "fix(ops): enforce global registration closure in submit-registration"
```

---

### Task 6: Zod + Server Action penyimpanan (Owner)

**Files:**
- Create: `src/lib/forms/club-operational-settings-schema.ts`
- Create: `src/lib/actions/admin-club-operational-settings.ts`

- [ ] **Step 1:** Schema formulir dengan checkbox tidak terkirim ⇒ false:

```typescript
import { z } from "zod";

function checkboxToBoolean(value: unknown): boolean {
  if (value === "on" || value === true || value === "true" || value === "1")
    return true;
  return false;
}

export const clubOperationalSettingsSaveSchema = z.object({
  registrationGloballyDisabled: z.preprocess(
    checkboxToBoolean,
    z.boolean(),
  ),
  globalRegistrationClosedMessage: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) =>
      v === "" ? "" : v.slice(0, 500),
    ),
  maintenanceBannerPlainText: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) =>
      v === "" ? "" : v.slice(0, 800),
    ),
});
```

- [ ] **Step 2:** Server Action (**dua-argumen** untuk `useActionState`):

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { guardOwner, isAuthError } from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import {
  clubOperationalSettingsSaveSchema,
} from "@/lib/forms/club-operational-settings-schema";
import {
  ok,
  rootError,
  fieldError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import {
  CLUB_OPERATIONAL_SINGLETON_KEY,
} from "@/lib/public/load-club-operational-settings";

export async function saveClubOperationalSettings(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  try {
    await guardOwner();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const parsed = clubOperationalSettingsSaveSchema.safeParse({
    registrationGloballyDisabled: formData.get("registrationGloballyDisabled"),
    globalRegistrationClosedMessage:
      formData.get("globalRegistrationClosedMessage"),
    maintenanceBannerPlainText: formData.get("maintenanceBannerPlainText"),
  });

  if (!parsed.success)
    return fieldError(zodToFieldErrors(parsed.error));

  try {
    await prisma.clubOperationalSettings.upsert({
      where: { singletonKey: CLUB_OPERATIONAL_SINGLETON_KEY },
      create: {
        singletonKey: CLUB_OPERATIONAL_SINGLETON_KEY,
        registrationGloballyDisabled: parsed.data.registrationGloballyDisabled,
        globalRegistrationClosedMessage:
          parsed.data.globalRegistrationClosedMessage === ""
            ? null
            : parsed.data.globalRegistrationClosedMessage,
        maintenanceBannerPlainText:
          parsed.data.maintenanceBannerPlainText === ""
            ? null
            : parsed.data.maintenanceBannerPlainText,
      },
      update: {
        registrationGloballyDisabled: parsed.data.registrationGloballyDisabled,
        globalRegistrationClosedMessage:
          parsed.data.globalRegistrationClosedMessage === ""
            ? null
            : parsed.data.globalRegistrationClosedMessage,
        maintenanceBannerPlainText:
          parsed.data.maintenanceBannerPlainText === ""
            ? null
            : parsed.data.maintenanceBannerPlainText,
      },
    });
  } catch {
    return rootError("Gagal menyimpan pengaturan.");
  }

  revalidatePath("/admin/settings/operations");
  revalidatePath("/");
  revalidatePath("/events");
  return ok({ saved: true });
}
```

- [ ] **Step 3: Commit dua file baru.**

```bash
git add src/lib/forms/club-operational-settings-schema.ts src/lib/actions/admin-club-operational-settings.ts
git commit -m "feat(admin): owner action to persist operational settings"
```

---

### Task 7: Komponen klien form

**Files:**
- Create: `src/components/admin/club-operational-settings-form.tsx`

- [ ] **Step 1:** Pola dari `**/club-branding-settings-form.tsx` — `useActionState(saveClubOperationalSettings, null)`. Gunakan **`form action={dispatch}`**.

Gunakan **`input type="checkbox" name="registrationGloballyDisabled" value="on"`** bersama **`defaultChecked`** dari props seperti **`event-admin-form.tsx`**.

Gunakan dua **`Textarea`**: nama `globalRegistrationClosedMessage`, `maintenanceBannerPlainText` — label bahasa Indonesia menjelaskan bahwa pertama hanya ditampilkan ke pengguna jika penutupan global aktif; kedua boleh dikosongkan untuk menyembunyikan banner.

Tampilkan **`Alert`** bila `state?.ok === false` seperti formulir branding.

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/club-operational-settings-form.tsx
git commit -m "feat(admin): operations settings client form"
```

---

### Task 8: Halaman `/admin/settings/operations`

**Files:**
- Modify: `src/app/admin/settings/operations/page.tsx`

- [ ] **Step 1:** Hapus `CommitteeSettingsPlaceholder`. Prefetch prisma row `clubOperationalSettings` dengan key `default`; set props awal Checkbox + textarea (string kosong = field kosong seperti branding).

Gunakan breadcrumbs/judul seperti `**/admin/settings/branding/page.tsx` (breadcrumb “Pengaturan / …”).

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/settings/operations/page.tsx
git commit -m "feat(admin): operations settings page"
```

---

### Task 9: Banner di layout publik

**Files:**
- Modify: `src/app/(public)/layout.tsx`

- [ ] **Step 1:** `await loadClubOperationalSettings()` bisa digabung `Promise.all` dengan branding untuk satu round-trip.

Tarik teks efektif:

```tsx
const ops = await loadClubOperationalSettings();
const bannerText = effectiveMaintenanceBanner(ops.maintenanceBannerPlainText);
```

Render:

```tsx
{bannerText ? (
  <div className="border-b bg-muted/50 px-4 py-3">
    <Alert>
      <AlertTitle>Pemberitahuan</AlertTitle>
      <AlertDescription>{bannerText}</AlertDescription>
    </Alert>
  </div>
) : null}
```

Letakkan setelah **`PublicHeader`**, sebelum pembungkus utama `children`. Impor **`Alert*`** dari ui, serta **`effectiveMaintenanceBanner`**, **`loadClubOperationalSettings`**.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/layout.tsx
git commit -m "feat(public): show maintenance banner when configured"
```

---

### Task 10: Hub Pengaturan — salinan kartu

**Files:**
- Modify: `src/app/admin/settings/page.tsx`

- [ ] **Step 1:** Ganti **`description`** pada kartu **`/admin/settings/operations`** dengan kalimat konkret (penutupan pendaftaran global + banner perawatan bagi pengunjung; bahasa Indonesia; tanpa frasa roadmap).

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/settings/page.tsx
git commit -m "docs(admin): hub copy for operational settings"
```

---

### Task 11: Gates kualitas

- [ ] **Step 1: Lint**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint
```

Expected: tidak ada **error** baru (peringatan yang sudah ada diperbolehkan).

- [ ] **Step 2: Tes**

```bash
pnpm test
```

Expected: seluruh berkas tes PASS termasuk baru.

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: keluar kode **0**.

- [ ] **Step 4:** Commit **hanya bila ada perbaikan** yang muncul dari gate.

---

## Spec coverage checklist

| Butir spek | Task |
|-----------|------|
| §5.4 key stabil + dokumen perilaku satu baris per flag dalam kode | `club-operational-policy.ts` + tabel “Perilaku produk yang di-lock” |
| Phase C banner / tutup registrasi global | Tasks 4, 5, 9 |
| §5.5 audit untuk flag operasional | **Ditunda Phase D** (per bagian atas rencana) |

---

Plan complete dan disimpan sebagai `docs/superpowers/plans/2026-05-02-admin-settings-phase-c-operations-flags.md`.

**Dua opsi eksekusi:**

**1. Subagent-Driven (disarankan)** — subagent baru per task, review antar-task, iterasi cepat.

**2. Inline Execution** — jalankan tugas bertahap dalam sesi ini memakai skil executing-plans dengan checkpoint berkala.

Mana yang Anda pilih?
