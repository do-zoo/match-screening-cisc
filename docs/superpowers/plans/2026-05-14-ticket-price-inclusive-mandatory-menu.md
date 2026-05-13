# Tiket inklusif menu wajib (nominal bayar = harga tiket) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satukan model bisnis dengan kode: harga tiket acara sudah **final** dan **sudah termasuk** menu wajib; peserta membayar **hanya** nominal tiket (`ticketMemberPrice` / `ticketNonMemberPrice`). Harga menu kanonik tetap dipakai sebagai **acuan alokasi ke venue** (kolom `mandatoryMenuPriceApplied`), bukan sebagai tambahan di total transfer.

**Architecture:** Ubah `computeSubmitTotal` agar `primaryTotal` / `partnerTotal` / `grandTotal` hanya menjumlahkan harga tiket, sambil tetap mengembalikan `primaryMenuPrice` / `partnerMenuPrice` dan baris `lines` untuk menu (nilai nominal menu tetap ada untuk audit/alokasi). Penyimpanan snapshot di `submit-registration.ts` mengikuti hasil itu. Rumus settlement bendahara (`getSettlementExpectedAmounts`) diganti menjadi berbasis **`baselineTotalApproved − menuVenuePayoutApproved + adjustmentsPaidTotal`** agar benar untuk pendaftaran lama (tiket + menu dijumlahkan) dan baru (tiket inklusif). UI admin ringkasan harga mendukung **kedua** bentuk snapshot lewat aturan tampilan sederhana.

**Tech Stack:** Next.js App Router, Prisma, Vitest, modul `src/lib/pricing/compute-submit-total.ts`, laporan `src/lib/reports/*`, komponen publik `price-breakdown.tsx`, admin `price-snapshot-section.tsx`.

---

## Peta file (tanggu jawab)

| Area | File |
|------|------|
| Sumber kebenaran total bayar | `src/lib/pricing/compute-submit-total.ts`, `src/lib/pricing/compute-submit-total.test.ts` |
| Snapshot DB saat submit | `src/lib/actions/submit-registration.ts` |
| Override validasi member / ganti tipe harga | `src/lib/actions/member-validation.ts` |
| Ringkasan biaya publik | `src/components/public/price-breakdown.tsx`, `src/components/public/registration-form/use-pricing-preview.ts` |
| Snapshot admin ringkasan | `src/components/admin/registration-detail-panels/tab-summary/price-snapshot-section.tsx` |
| Settlement & bukti penutupan | `src/lib/reports/settlement-expected-amounts.ts`, `src/lib/reports/settlement-expected-amounts.test.ts`, `src/lib/actions/upload-event-settlement-proof.ts`, `src/app/admin/events/[eventId]/report/page.tsx` |
| Uji komponen terkait | `src/components/admin/registration-detail.test.ts` (fixture angka snapshot) |
| Dokumentasi proyek | `CLAUDE.md` (bagian Pricing + laporan keuangan bila perlu) |

---

### Task 1: `computeSubmitTotal` — total bayar = tiket saja

**Files:**
- Modify: `src/lib/pricing/compute-submit-total.ts`
- Modify: `src/lib/pricing/compute-submit-total.test.ts`

**Semantik yang dipegang teguh:**
- `primaryTicketPrice` / `partnerTicketPrice`: dari harga tiket acara (sama seperti sekarang).
- `primaryMenuPrice` / `partnerMenuPrice`: harga referensi item menu wajib dari katalog (sama seperti sekarang).
- `primaryTotal` / `partnerTotal` / `grandTotal`: **hanya** jumlah tiket (menu **tidak** ditambahkan).
- `lines`: tetap ada entri `kind: "menu"` dengan `amount` = harga referensi menu (untuk konsistensi data); pemanggil UI yang menghitung subtotal harus memakai `grandTotal` / `primaryTotal`, bukan menjumlahkan semua `lines` tanpa filter, atau nanti Task 4 menyesuaikan `PriceBreakdown`.

- [ ] **Step 1: Ubah implementasi `computeSubmitTotal`**

Di `compute-submit-total.ts`, ganti perhitungan total:

```ts
const primaryTotal = primaryTicket; // was: primaryTicket + primaryMenu
// ...
const partnerTotal =
  input.partnerMandatoryMenu && input.partnerPriceType
    ? partnerTicket! // was: partnerTicket! + partnerMenu!
    : undefined;
```

Sesuaikan komentar satu baris di atas tipe `SubmitPricingResult` bahwa `*Total` dan `grandTotal` adalah **nominal yang dibayar peserta**, bukan tiket+menu.

- [ ] **Step 2: Tulis ulang ekspektasi tes**

Di `compute-submit-total.test.ts`, untuk kasus `baseEvent` (tiket member 500_000, menu 150_000):

- `expect(result.primaryTotal).toBe(500_000)` (bukan 650_000).
- `expect(result.grandTotal).toBe(500_000)` untuk tes primary-only.
- Tes primary+partner: `primaryTotal` 500_000, `partnerTotal` 500_000 (tiket partner member), `grandTotal` 1_000_000 (bukan 1_250_000).
- Tes non-member partner: `grandTotal` sesuai hanya penjumlahan tiket (500_000 + 750_000 = 1_250_000).

Tetap assert `primaryMenuPrice` / `partnerMenuPrice` dan panjang `lines` (2 atau 4) seperti semula.

- [ ] **Step 3: Jalankan tes**

Run:

```bash
cd /Users/mac/Documents/CISC/match-screening && export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use && pnpm vitest run src/lib/pricing/compute-submit-total.test.ts
```

Expected: semua lulus.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pricing/compute-submit-total.ts src/lib/pricing/compute-submit-total.test.ts
git commit -m "fix(pricing): total bayar registrasi hanya nominal tiket (menu inklusif)"
```

---

### Task 2: Verifikasi `submit-registration` — snapshot mengikuti pricing

**Files:**
- Read-only lalu modify bila perlu: `src/lib/actions/submit-registration.ts`

Tidak perlu mengubah nama field Prisma: `ticketPriceApplied` ← `pricing.primaryTicketPrice`, `mandatoryMenuPriceApplied` ← `pricing.primaryMenuPrice`, `computedTotalAtSubmit` ← `pricing.primaryTotal` (setelah Task 1, `primaryTotal` sudah = tiket saja).

- [ ] **Step 1: Konfirmasi mapping baris 345–347 dan 366–368** tetap konsisten dengan return `computeSubmitTotal`.

- [ ] **Step 2: Jalankan tes integrasi terkait submit bila ada**

```bash
pnpm vitest run src/lib/actions --grep submit
```

(Atau file spesifik jika ada `submit-registration` test.) Expected: lulus atau perbaiki assert yang mengandalkan total lama.

- [ ] **Step 3: Commit** (hanya jika ada perubahan teks komentar / assert)

```bash
git commit -m "chore(registration): dokumentasi snapshot selaras tiket inklusif"
```

---

### Task 3: `overrideMemberValidation` — total setelah override tipe harga

**Files:**
- Modify: `src/lib/actions/member-validation.ts`

Saat ini: `computedTotalAtSubmit: newTicketPrice + reg.mandatoryMenuPriceApplied`.

Harus: `computedTotalAtSubmit: newTicketPrice` (menu tetap snapshot referensi, tidak ditambahkan ke yang harus dibayar).

- [ ] **Step 1: Ganti satu baris update** seperti di atas.

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/member-validation.ts
git commit -m "fix(admin): override tipe harga tidak menambah menu ke total bayar"
```

---

### Task 4: Publik — `PriceBreakdown` selaras dengan `grandTotal`

**Files:**
- Modify: `src/components/public/price-breakdown.tsx`

Masalah sekarang: komponen hanya menampilkan baris `kind === "ticket"` untuk subtotal per peran, tetapi **Total dibayar** memakai `pricing.grandTotal` — setelah Task 1 ketiga angka selaras; tetap periksa apakah perlu menampilkan menu sebagai informasi (tanpa menambah subtotal).

- [ ] **Step 1: Tambah blok opsional** di bawah baris tiket per section: jika ada `lines` dengan `kind === "menu"` untuk role yang sama, tampilkan satu baris teks mis. `Menu wajib: {nama dari label}` tanpa nominal tambahan di subtotal, atau tampilkan nominal dengan kelas `text-muted-foreground` dan keterangan singkat **"(termasuk dalam tiket)"** (string Indonesia).

- [ ] **Step 2: Pastikan subtotal per section** sama dengan bagian tiket untuk role itu, dan **Total dibayar** = `pricing.grandTotal`.

- [ ] **Step 3: Commit**

```bash
git add src/components/public/price-breakdown.tsx
git commit -m "fix(public): ringkasan biaya jelaskan menu wajib inklusif di tiket"
```

---

### Task 5: Admin — `PriceSnapshotSection` (legacy + baru)

**Files:**
- Modify: `src/components/admin/registration-detail-panels/tab-summary/price-snapshot-section.tsx`
- Modify: `src/components/admin/registration-detail.test.ts` (fixture & assert jika memanggil `buildPriceSnapshotSummary`)

**Aturan tampilan (per baris tiket / registration row):**

- Hitung `const additiveLegacy = row.ticketPriceApplied + row.mandatoryMenuPriceApplied === row.computedTotalAtSubmit` (gunakan perbandingan integer ketat).
- Jika `additiveLegacy`: tampilkan tiga baris seperti sekarang (Tiket, Menu wajib + nominal, Subtotal) — ini data lama sebelum perubahan bisnis.
- Jika tidak (model baru): tampilkan satu baris nominal **Tiket (termasuk menu wajib)** = `formatCurrencyIdr(row.ticketPriceApplied)` dengan `row.mandatoryMenuItemName` sebagai teks sekunder; **jangan** menambahkan baris subtotal terpisah yang menjumlahkan menu; total baris = `computedTotalAtSubmit` (harus sama dengan tiket).

Ekspor `buildPriceSnapshotSummary` tetap bisa mengembalikan struktur yang sama; boleh menambah field opsional `displayMode: "additive" | "inclusive"` per row untuk memudahkan render.

- [ ] **Step 1: Implementasi helper** `isAdditivePriceSnapshot(row)` di file yang sama atau di atas `buildPriceSnapshotSummary`.

- [ ] **Step 2: Update render** sesuai dua mode.

- [ ] **Step 3: Update tes** di `registration-detail.test.ts`: tambah kasus fixture **inclusive** (mis. tiket 500_000, menu 150_000, computed 500_000) dan assert tidak ada double-count.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/registration-detail-panels/tab-summary/price-snapshot-section.tsx src/components/admin/registration-detail.test.ts
git commit -m "fix(admin): snapshot harga mendukung tiket inklusif dan data lama"
```

---

### Task 6: Settlement — `getSettlementExpectedAmounts` memakai baseline

**Files:**
- Modify: `src/lib/reports/settlement-expected-amounts.ts`
- Modify: `src/lib/reports/settlement-expected-amounts.test.ts`
- Modify: `src/lib/actions/upload-event-settlement-proof.ts`
- Modify: `src/app/admin/events/[eventId]/report/page.tsx`

**Rumus baru (bukti tunggal):**

- `venueMenuPayout` = `menuVenuePayoutApproved` (tetap).
- `treasurerMargin` = `baselineTotalApproved - menuVenuePayoutApproved + adjustmentsPaidTotal`.

**Tipe snapshot:** perluas `SettlementFinanceSnapshot`:

```ts
export type SettlementFinanceSnapshot = {
  baselineTotalApproved: number;
  menuVenuePayoutApproved: number;
  adjustmentsPaidTotal: number;
  /** Opsional: disimpan untuk kompatibilitas / logging; tidak dipakai rumus utama. */
  ticketRevenueApproved?: number;
};
```

Implementasi:

```ts
export function getSettlementExpectedAmounts(f: SettlementFinanceSnapshot) {
  return {
    venueMenuPayout: f.menuVenuePayoutApproved,
    treasurerMargin:
      f.baselineTotalApproved -
      f.menuVenuePayoutApproved +
      f.adjustmentsPaidTotal,
  };
}
```

- [ ] **Step 1: Ubah tipe + fungsi** di `settlement-expected-amounts.ts` + komentar dokumen bahwa rumus ini benar untuk pendaftaran lama (total = tiket+menu) dan baru (total = tiket).

- [ ] **Step 2: Update tes** di `settlement-expected-amounts.test.ts`:

```ts
expect(
  getSettlementExpectedAmounts({
    baselineTotalApproved: 1_400_000, // mis. 650k + 750k legacy two tickets
    menuVenuePayoutApproved: 400_000,
    adjustmentsPaidTotal: 50_000,
  }),
).toEqual({ venueMenuPayout: 400_000, treasurerMargin: 1_050_000 });
```

(Pilih angka konsisten: 1_400_000 − 400_000 + 50_000 = 1_050_000.)

- [ ] **Step 3: Update pemanggil** `upload-event-settlement-proof.ts` dan `report/page.tsx` untuk mengisi `baselineTotalApproved: report.finance.baselineTotal` dan `ticketRevenueApproved` opsional jika masih berguna untuk tampilan.

- [ ] **Step 4: Jalankan tes**

```bash
pnpm vitest run src/lib/reports/settlement-expected-amounts.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/settlement-expected-amounts.ts src/lib/reports/settlement-expected-amounts.test.ts src/lib/actions/upload-event-settlement-proof.ts src/app/admin/events/[eventId]/report/page.tsx
git commit -m "fix(reports): acuan margin bendahara dari baseline − menu + penyesuaian"
```

---

### Task 7: Laporan admin — copy "Keuangan" agar tidak menyesatkan

**Files:**
- Modify: `src/app/admin/events/[eventId]/report/page.tsx`

Setelah perubahan, `baselineTotal` dan agregat `ticketRevenueApproved` bisa sama untuk acara yang seluruhnya snapshot baru. Tambahkan satu kalimat di `CardDescription` blok Keuangan: bahwa **nominal tiket tercatat sudah termasuk menu wajib** untuk pendaftaran baru, sementara **Total Uang Masuk** mengikuti snapshot `computedTotalAtSubmit` per pendaftaran (termasuk data lama).

- [ ] **Step 1: Edit teks Indonesia** saja (tanpa mengubah query kecuali sudah di Task 6).

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/events/[eventId]/report/page.tsx
git commit -m "docs(ui): jelaskan tiket inklusif di kartu laporan keuangan"
```

---

### Task 8: CSV & export — header atau dokumentasi kolom

**Files:**
- Modify: `src/lib/reports/csv.ts` (header baris pertama atau komentar modul jika header dihasilkan dinamis)

Pastikan label kolom untuk `mandatoryMenuPriceApplied` menyebut **acuan alokasi / harga referensi menu**, bukan "tambahan dibayar peserta", agar operator tidak salah baca setelah model inklusif.

- [ ] **Step 1: Cari string header CSV** dan sesuaikan teks Indonesia.

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/csv.ts
git commit -m "docs(csv): klarifikasi kolom menu wajib sebagai acuan alokasi"
```

---

### Task 9: `CLAUDE.md` — bagian Pricing

**Files:**
- Modify: `CLAUDE.md`

Tambahkan bullet singkat di bagian **Pricing** (atau **Architecture**) yang menyatakan:

- Nominal transfer peserta mengikuti `computeSubmitTotal` → **total = harga tiket**; harga menu wajib dari katalog disimpan di `mandatoryMenuPriceApplied` untuk alokasi venue/laporan, bukan ditambahkan ke total bayar.
- Snapshot lama dengan penjumlahan tiket+menu tetap valid; UI admin membedakan tampilan.

- [ ] **Step 1: Edit `CLAUDE.md`**.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: model harga tiket inklusif menu wajib"
```

---

### Task 10: Verifikasi akhir

- [ ] **Step 1: Lint**

```bash
pnpm lint
```

Expected: tanpa error baru pada file yang disentuh.

- [ ] **Step 2: Seluruh unit test (waktu memungkinkan)**

```bash
pnpm test
```

Expected: lulus.

- [ ] **Step 3: Commit** hanya jika ada perbaikan follow-up.

---

## Self-review (checklist penulis rencana)

1. **Spec coverage:** Kebutuhan user (bayar = tiket, menu inklusif) ter-cover oleh Task 1–2, 3, 4, 5; laporan/settlement Task 6–7; operator CSV Task 8; dokumentasi Task 9; data lama Task 5 + rumus Task 6.
2. **Placeholder scan:** Tidak ada TBD/TODO generik.
3. **Konsistensi:** `SettlementFinanceSnapshot` di semua pemanggil di-update bersamaan (Task 6).

---

## Catatan migrasi data (di luar scope wajib rencana ini)

Tidak memerlukan migrasi Prisma jika hanya mengubah logika hitung untuk pendaftaran **baru**. Pendaftaran **lama** tetap konsisten dengan rumus settlement baru (`baseline − menu + adj` ≡ `sum(ticket) + adj` untuk model lama). Jika suatu saat ingin **menormalisasi** baris lama ke model inklusif di DB, itu jadi tugas terpisah dengan aturan bisnis (menaikkan `ticketPriceApplied` dan menurunkan `computedTotalAtSubmit`?) — **jangan** lakukan otomatis tanpa persetujuan operator.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-14-ticket-price-inclusive-mandatory-menu.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — satu subagen per task, review antar task, iterasi cepat.

**2. Inline Execution** — jalankan task dalam sesi ini dengan executing-plans, eksekusi berkelompok dengan checkpoint review.

**Which approach do you want?**
