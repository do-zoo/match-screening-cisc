# Bukti rekapitulasi keuangan acara (venue + bendahara) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memungkinkan PIC acara atau Owner/Admin operasional mengunggah bukti penutupan keuangan per acara—transfer ke venue (plus nota/bukti terima venue), transfer margin ke bendahara—dengan riwayat append-only, validasi lunak terhadap angka acuan laporan, dan jejak audit di server.

**Architecture:** Model Prisma `EventSettlementArtifact` (satu baris per unggahan, satu `Upload` per baris) memakai enum `EventSettlementArtifactKind`. Angka acuan dihitung ulang di server lewat fungsi murni yang membungkus data yang sama dengan `getEventReport` (`ticketRevenueApproved`, `menuVenuePayoutApproved`, `adjustmentsPaidTotal`) agar UI dan server action konsisten. Izin: setelah `guardEvent`, cek `event.picAdminProfileId === ctx.profileId` **atau** `hasOperationalOwnerParity(ctx.role)` dari `lib/permissions/roles.ts`. Unggah gambar mengikuti pola `upload-adjustment-proof.ts` (WebP, Blob, rollback hapus blob jika DB gagal).

**Tech Stack:** Prisma + PostgreSQL, Next.js App Router, Server Actions `ActionResult`, Vitest, Vercel Blob + Sharp WebP, UI Indonesia.

---

## File Map

| File | Tanggung jawab |
|------|----------------|
| `prisma/schema.prisma` | Enum `EventSettlementArtifactKind`, enum `UploadPurpose` (+3 nilai), model `EventSettlementArtifact`, relasi `Event` / `AdminProfile` / `Upload` |
| `prisma/migrations/*/migration.sql` | Hasil `pnpm db:migrate:dev` (nama folder dari Prisma) |
| `src/lib/reports/settlement-expected-amounts.ts` | `getSettlementExpectedAmountsForEvent(report: EventReport['finance']): { venueMenuPayout: number; treasurerMargin: number }` — rumus terpusat + komentar satu sumber kebenaran |
| `src/lib/reports/settlement-expected-amounts.test.ts` | Unit test rumus dari objek finance tiruan |
| `src/lib/actions/guard-event-settlement.ts` | `assertCanManageEventSettlement(ctx, eventId): Promise<{ eventId: string; picAdminProfileId: string }>` — `guardEvent` + load PIC + cek izin; lempar `FORBIDDEN` jika tidak lolos |
| `src/lib/actions/upload-event-settlement-proof.ts` | Server action: validasi file, delta nominal, `mismatchAcknowledged` + `mismatchReason`, nested create artifact + upload, `revalidatePath` laporan |
| `src/lib/reports/queries.ts` | (Opsional) Re-export atau panggil helper expected amounts dari `getEventReport` agar halaman laporan tidak duplikasi query |
| `src/app/admin/events/[eventId]/report/page.tsx` | `Promise.all` + `findMany` artifact; render section baru |
| `src/components/admin/event-settlement-proofs-panel.tsx` | Client: form unggah per `kind`, daftar riwayat, dialog konfirmasi selisih |
| `CLAUDE.md` | Route/layout: catatan modul settlement; data model baru |
| `docs/user-stories-stakeholder.md` | Tambah/mutakhirkan US terkait bukti penutupan (opsional satu paragraf kriteria) |

**Rumus v1 (wajib dokumentasikan di `settlement-expected-amounts.ts`):**

- `venueMenuPayout` = `finance.menuVenuePayoutApproved` (sama agregat menu wajib approved seperti laporan).
- `treasurerMargin` = `finance.ticketRevenueApproved + finance.adjustmentsPaidTotal` (tiket approved + penyesuaian yang sudah dibayar masuk ke komite; jika komite mengubah definisi nanti, ubah hanya fungsi ini).

**Konstanta toleransi:** `SETTLEMENT_AMOUNT_TOLERANCE_IDR = 50_000` di `settlement-expected-amounts.ts` (satu tempat). Jika `|declared - expected| > toleransi`, wajib `mismatchAcknowledged === true` dan `mismatchReason` string terpotong aman (mis. max 2000 char) sebelum simpan; jika tidak, server action mengembalikan `fieldError` / `rootError` berbahasa Indonesia.

**Kategori `venue_receipt`:** `declaredAmountIdr` boleh `null`; dalam kasus itu **lewati** perbandingan nominal (hanya validasi file + izin). Untuk `venue_transfer` dan `treasurer_margin`, `declaredAmountIdr` wajib integer ≥ 0.

---

## Task 1: Skema Prisma + migrasi

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_event_settlement_artifacts/migration.sql` (via CLI, jangan tulis nama timestamp manual di plan eksekusi—gunakan `pnpm db:migrate:dev`)

Tambahkan enum:

```prisma
enum EventSettlementArtifactKind {
  venue_transfer
  venue_receipt
  treasurer_margin
}
```

Perluas `UploadPurpose`:

```prisma
  event_settlement_venue_transfer
  event_settlement_venue_receipt
  event_settlement_treasurer_margin
```

Model (sesuaikan urutan dengan gaya file Anda):

```prisma
model EventSettlementArtifact {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  kind      EventSettlementArtifactKind

  declaredAmountIdr   Int?
  expectedAmountIdr   Int?
  amountDeltaIdr      Int?
  mismatchAcknowledged Boolean @default(false)
  mismatchReason      String? @db.Text

  uploadId String @unique
  upload   Upload @relation(fields: [uploadId], references: [id], onDelete: Restrict)

  uploadedByAdminProfileId String
  uploadedBy               AdminProfile @relation(fields: [uploadedByAdminProfileId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())

  @@index([eventId, kind, createdAt])
}
```

Di `Event`, `AdminProfile`, dan `Upload`, tambahkan relasi balik yang diperlukan (`eventSettlementArtifacts`, dll.).

- [ ] **Step 1:** Edit `schema.prisma` seperti di atas; jalankan `export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm prisma format`.
- [ ] **Step 2:** `pnpm db:migrate:dev` dengan nama migrasi `event_settlement_artifacts` (atau setara). Pastikan `pnpm prisma generate` sukses.

---

## Task 2: Fungsi murni angka acuan + tes

**Files:**

- Create: `src/lib/reports/settlement-expected-amounts.ts`
- Create: `src/lib/reports/settlement-expected-amounts.test.ts`

```typescript
// settlement-expected-amounts.ts
export const SETTLEMENT_AMOUNT_TOLERANCE_IDR = 50_000;

export type SettlementFinanceSnapshot = {
  ticketRevenueApproved: number;
  menuVenuePayoutApproved: number;
  adjustmentsPaidTotal: number;
};

export function getSettlementExpectedAmounts(
  f: SettlementFinanceSnapshot,
): { venueMenuPayout: number; treasurerMargin: number } {
  return {
    venueMenuPayout: f.menuVenuePayoutApproved,
    treasurerMargin: f.ticketRevenueApproved + f.adjustmentsPaidTotal,
  };
}

export function settlementAmountMismatch(
  declared: number,
  expected: number,
): { delta: number; withinTolerance: boolean } {
  const delta = declared - expected;
  return {
    delta,
    withinTolerance: Math.abs(delta) <= SETTLEMENT_AMOUNT_TOLERANCE_IDR,
  };
}
```

```typescript
// settlement-expected-amounts.test.ts
import { describe, it, expect } from "vitest";
import {
  getSettlementExpectedAmounts,
  settlementAmountMismatch,
  SETTLEMENT_AMOUNT_TOLERANCE_IDR,
} from "./settlement-expected-amounts";

describe("getSettlementExpectedAmounts", () => {
  it("maps finance snapshot to venue and treasurer expectations", () => {
    expect(
      getSettlementExpectedAmounts({
        ticketRevenueApproved: 1_000_000,
        menuVenuePayoutApproved: 400_000,
        adjustmentsPaidTotal: 50_000,
      }),
    ).toEqual({ venueMenuPayout: 400_000, treasurerMargin: 1_050_000 });
  });
});

describe("settlementAmountMismatch", () => {
  it("is within tolerance at exact boundary", () => {
    const { withinTolerance, delta } = settlementAmountMismatch(
      100 + SETTLEMENT_AMOUNT_TOLERANCE_IDR,
      100,
    );
    expect(withinTolerance).toBe(true);
    expect(delta).toBe(SETTLEMENT_AMOUNT_TOLERANCE_IDR);
  });

  it("is outside tolerance when beyond one rupiah", () => {
    const { withinTolerance } = settlementAmountMismatch(
      SETTLEMENT_AMOUNT_TOLERANCE_IDR + 2,
      0,
    );
    expect(withinTolerance).toBe(false);
  });
});
```

- [ ] **Step 1:** Tambahkan kedua file; jalankan  
  `export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/reports/settlement-expected-amounts.test.ts`  
  **Expected:** semua tes PASS.

---

## Task 3: Guard PIC / Owner / Admin

**Files:**

- Create: `src/lib/actions/guard-event-settlement.ts`

```typescript
"use server";

import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import type { AdminContext } from "@/lib/permissions/guards";

export async function assertCanManageEventSettlement(
  eventId: string,
  ctx: AdminContext,
): Promise<{ picAdminProfileId: string }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { picAdminProfileId: true },
  });
  if (!event) throw new Error("FORBIDDEN");
  const isPic = ctx.profileId === event.picAdminProfileId;
  const isOps = hasOperationalOwnerParity(ctx.role);
  if (!isPic && !isOps) throw new Error("FORBIDDEN");
  return { picAdminProfileId: event.picAdminProfileId };
}
```

Pola pemakaian di action: `const ctx = await guardEvent(eventId); await assertCanManageEventSettlement(eventId, ctx);` — tangkap `isAuthError` dan `e.message === "FORBIDDEN"` untuk pesan Indonesia.

- [ ] **Step 1:** Tambahkan file; impor hanya dari modul yang sudah ada; pastikan tidak ada siklus impor dengan action unggah.

---

## Task 4: Server action unggah bukti

**Files:**

- Create: `src/lib/actions/upload-event-settlement-proof.ts`

Salin struktur dari `src/lib/actions/upload-adjustment-proof.ts`: `MAX_BYTES`, `ALLOWED_TYPES`, `toWebp`, `putWebpToBlob`, `retry`, `del` rollback.

Input `FormData`: `kind` (`venue_transfer` | `venue_receipt` | `treasurer_margin`), `file`, `declaredAmountIdr` (string digit opsional; untuk receipt boleh kosong), `mismatchAcknowledged` (`"true"` / absent), `mismatchReason`.

Alur:

1. `guardEvent` → `assertCanManageEventSettlement`.
2. Parse `kind` dengan `z.nativeEnum(EventSettlementArtifactKind)` atau setara; gagal → `fieldError` Indonesia.
3. Ambil `getEventReport(eventId)`; dari `report.finance` hitung `getSettlementExpectedAmounts({ ticketRevenueApproved: ..., menuVenuePayoutApproved: ..., adjustmentsPaidTotal: ... })`.
4. Tentukan `expected` per kind (`venue_transfer` / `treasurer_margin` → expected terkait; `venue_receipt` → skip nominal).
5. Parse nominal: gunakan `parseIdrDigitsToInt` dari `lib/utils/idr-input.ts` jika input teks; atau integer dari hidden field.
6. Jika kind membutuhkan nominal dan `!withinTolerance && !mismatchAcknowledged` → `rootError("Selisih nominal terlalu besar. Centang konfirmasi dan isi alasan.")` (bahasa Indonesia konkret).
7. `blobPath = \`events/${eventId}/settlement/${crypto.randomUUID()}.webp\`` (atau `randomUUID` dari `node:crypto`).
8. `prisma.upload.create` lalu `prisma.eventSettlementArtifact.create` dengan `uploadId` (nested `upload: { create }` tidak dipakai — batasan tipe Prisma pada relasi ini).
9. `revalidatePath(\`/admin/events/${eventId}/report\`)`.
10. Return `ok({ artifactId })`.

- [ ] **Step 1:** Implementasi lengkap; tangani `isAuthError` → `rootError("Tidak diizinkan.")`.
- [ ] **Step 2:** `pnpm lint` pada file baru.

---

## Task 5: UI panel di halaman laporan

**Files:**

- Modify: `src/app/admin/events/[eventId]/report/page.tsx` — `select: { title, status, picAdminProfileId }` pada event; `prisma.eventSettlementArtifact.findMany({ where: { eventId }, orderBy: { createdAt: "desc" }, include: { upload: true, uploadedBy: { select: { id: true, role: true, authUserId: true } } } })` lalu batch `prisma.user.findMany({ where: { id: { in: authUserIds } }, select: { id: true, name: true, email: true } })` (`User` memetakan `AdminProfile.authUserId` → `user.name` untuk label riwayat).
- Create: `src/components/admin/event-settlement-proofs-panel.tsx` — `"use client"`; tiga dropzone/ tombol unggah terpisah per kind; tabel riwayat; panggil action lalu `toastCudSuccess` / `toastActionErr` dari `lib/client/cud-notify.ts`.

Tampilkan angka acuan dari props server (venue / treasurer) agar PIC melihat perbandingan sebelum submit. Untuk selisih > toleransi, tampilkan dialog dengan textarea alasan + checkbox sebelum kirim `FormData` dengan flag.

- [ ] **Step 1:** Wiring server props ke client panel.
- [ ] **Step 2:** Manual smoke: unggah tiga jenis (gunakan gambar kecil) di dev.

---

## Task 6: Dokumentasi

**Files:**

- Modify: `CLAUDE.md` — bagian Data model (`EventSettlementArtifact`, enum), Key library modules (`settlement-expected-amounts.ts`, `upload-event-settlement-proof.ts`), dan satu kalimat di Route layout untuk `/admin/events/[eventId]/report` (panel bukti penutupan).
- Modify: `docs/user-stories-stakeholder.md` — perluas US-EVT-10 atau tambah US-EVT-11: PIC/Owner/Admin dapat mengunggah bukti dengan riwayat.

- [ ] **Step 1:** Commit dokumentasi bersama kode fitur.

---

## Task 7: Verifikasi akhir

- [ ] **Step 1:** Dari root repo dengan Node 24: `pnpm lint && pnpm test && pnpm build` (sesuai AGENTS.md / CLAUDE.md).

**Expected:** tanpa error; jika build gagal karena env, minimal `lint` + `test` lulus di mesin pengembang.

---

## Self-review (spec coverage)

| Kebutuhan percakapan | Task |
|----------------------|------|
| PIC + Owner/Admin operasional | Task 3 |
| Bukti transfer venue + nota/bukti terima | Enum `venue_transfer`, `venue_receipt` + UI dua slot |
| Bukti margin bendahara | `treasurer_margin` |
| Validasi lunak + alasan | Task 2 + Task 4 (`mismatchAcknowledged` / `mismatchReason` + toleransi) |
| Beberapa versi | `findMany` order by `createdAt`; tidak update baris lama |
| Bahasa Indonesia error/toast | Task 4–5 |

**Placeholder scan:** Tidak ada TBD pada langkah wajib; rumus bendahara v1 eksplisit di Task 2 (dapat diubah satu file jika bisnis menyempurnakan).

**Type consistency:** `EventSettlementArtifactKind` Prisma harus sama string dengan parsing `FormData` (lowercase snake sesuai enum Prisma default).

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-14-event-settlement-proofs.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration (`superpowers:subagent-driven-development`).

**2. Inline Execution** — run tasks in this session with checkpoints (`superpowers:executing-plans`).

**Which approach?**
