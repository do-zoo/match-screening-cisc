# Holder Data Mode — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

## Problem

Saat ini setiap registrasi mewajibkan data peserta (holder) untuk setiap tiket yang dibeli. Jika membeli 3 tiket, pendaftar harus mengisi 3 holder card. Beberapa acara tidak membutuhkan ini — pemesan utama cukup mewakili semua tiket, dan harga tiket tambahan mengikuti status keanggotaan pemesan utama.

## Goal

Tambah setting per-event yang mengontrol apakah data holder non-utama wajib diisi atau cukup 1 data (pemesan utama) untuk semua tiket.

## Keputusan Desain

### 1. Schema — `Event.requireAllHolderData`

Tambah satu field boolean di model `Event`:

```prisma
model Event {
  // ... existing fields ...
  requireAllHolderData Boolean @default(true)
}
```

- `true` (default) — perilaku saat ini: N tiket = N holder card, semua wajib diisi
- `false` — mode primary-only: form hanya tampilkan 1 holder card; server mengkloning data holder utama ke slot 2+ saat submit

**Invariant dipertahankan:** `ticketQty` selalu sama dengan jumlah baris `RegistrationHolder` di DB.

### 2. Lock Behavior

Field dikunci setelah registrasi pertama masuk, konsisten dengan lock harga tiket (`EventTicketCategory`). Pola `registrationCount > 0` yang sudah ada di `event-edit-guards.ts` dipakai di server action:

```ts
if (registrationCount > 0 && input.requireAllHolderData !== existing.requireAllHolderData) {
  return rootError('Pengaturan data peserta tidak dapat diubah setelah ada pendaftar.')
}
```

### 3. Public Form

**`SerializedEventForRegistration`** ditambah `requireAllHolderData: boolean`.

**`registration-form.tsx`** — array `holders` di RHF selalu berisi 1 elemen ketika `requireAllHolderData = false`, meskipun `ticketQty > 1`.

**`step-one.tsx`** — hanya render `HolderCard` index 0 ketika `requireAllHolderData = false`:

```tsx
{(requireAllHolderData ? fields : fields.slice(0, 1)).map((field, index) => (
  <HolderCard key={field.id} index={index} ... />
))}
```

**`category-picker.tsx`** — tidak berubah. Qty picker tetap berjalan normal.

**`submit-registration-schema.ts`** — tidak berubah. `holders` tetap `min(1)`; validasi jumlah holder vs `ticketQty` adalah tanggung jawab server.

### 4. Submit Action — Kloning Holder

Di `lib/actions/submit-registration.ts`, setelah validasi form dan sebelum insert DB:

```ts
let holdersToInsert = validatedHolders
if (!event.requireAllHolderData && ticketQty > 1) {
  const primary = validatedHolders[0]
  holdersToInsert = Array.from({ length: ticketQty }, (_, i) =>
    i === 0 ? primary : { ...primary }
  )
}
// lanjut ke computeSubmitTotal(holdersToInsert) + insert DB
```

Field yang diklon dari holder utama ke slot 2+:
- `holderName`
- `holderWhatsapp`
- `claimedMemberNumber`
- `memberValidation`
- `memberId`
- `ticketPriceApplied`
- `mandatoryMenuItemId`

**`compute-submit-total.ts`** — tidak berubah. Menerima array holder lengkap (sudah dikloning sebelum dipanggil).

### 5. Pricing

Ketika `requireAllHolderData = false`, semua tiket otomatis menggunakan harga yang sama dengan holder utama (member atau reguler). Tidak ada cara untuk pendaftar mengklaim harga member untuk tiket tambahan secara terpisah — semua ikut status holder utama.

### 6. Admin Event Editor

**Lokasi:** komponen `src/components/admin/forms/event-admin-form.tsx`, di sekitar baris `multiCategoryPurchase` (line ~566). Keduanya adalah setting perilaku pendaftaran sehingga dikelompokkan bersama.

**Label UI:**
- Judul field: `"Data peserta tiket tambahan"`
- Deskripsi: `"Jika dinonaktifkan, hanya data pemesan utama yang dikumpulkan. Tiket tambahan mengikuti status keanggotaan pemesan utama."`

**Lock UI:** Toggle di-`disabled` setelah ada registrasi pertama, dengan caption:
> `"Tidak dapat diubah setelah ada pendaftar."`

### 7. Admin Detail Registrasi & Laporan

Tidak ada perubahan. Halaman detail peserta merender semua `RegistrationHolder` rows dari DB — slot kloning tampil dengan data yang sama dengan holder utama. Query laporan dan CSV tidak terpengaruh karena DB tetap menyimpan N rows untuk N tiket.

## Yang Tidak Berubah

- `compute-submit-total.ts` — menerima array holder lengkap, logika tidak berubah
- `RegistrationHolder` schema — tidak ada field baru
- Admin registrasi detail, laporan, dan CSV — bekerja pada rows yang sudah lengkap
- Invariant `ticketQty == holders.count`

## Out of Scope

- Mode hybrid (sebagian holder wajib, sebagian opsional)
- Mengubah setting setelah ada registrasi (dikunci)
- Migrasi data registrasi lama
