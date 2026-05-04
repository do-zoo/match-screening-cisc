# Design: Create Event Stepper & Edit Event Tabs

**Date:** 2026-05-04  
**Status:** Approved

## Overview

Halaman Buat Acara (`/admin/events/new`) diubah dari satu form panjang menjadi **Linear Stepper 4 step**. Halaman Edit Acara (`/admin/events/[eventId]/edit`) diubah menjadi **Tabs 4 tab** dengan grouping field yang sama.

Tujuan: mengurangi cognitive load saat membuat acara baru dengan memecah form menjadi tahap-tahap yang fokus.

---

## Pengelompokan Step / Tab

### Step 1 · Info Dasar
- Judul acara
- Ringkasan
- Deskripsi (rich text)
- Sampul (upload gambar)

### Step 2 · Jadwal & Venue
- Waktu mulai
- Waktu selesai
- Venue (combobox)
- Subset menu aktif (checkboxes per item venue)
- Status acara (draf / aktif / selesai)
- Kapasitas pendaftaran
- Tutup registrasi manual (checkbox)

### Step 3 · Tiket & Menu
- Sumber harga (default komite / override per acara)
- Harga tiket member (IDR)
- Harga tiket non-member (IDR)
- Mode menu (PRESELECT / VOUCHER)
- Pilihan menu (SINGLE / MULTI)
- Harga voucher (hanya aktif jika mode VOUCHER)

### Step 4 · PIC & Rekening
- PIC utama (combobox)
- Rekening pembayaran (combobox, tergantung PIC)
- PIC pembantu (multi-checkbox)
- Tombol "Buat Acara" (hanya di step ini)

---

## Create — Linear Stepper

### Step Bar

- Bar horizontal di atas form dengan 4 lingkaran bernomor + label
- Garis penghubung antar step
- **State visual:**
  - Step aktif: lingkaran berwarna accent, label bold
  - Step selesai: lingkaran hijau dengan ✓, label hijau, **bisa diklik** untuk kembali
  - Step terkunci: abu-abu, opacity rendah, tidak bisa diklik

### Navigasi

- Tombol **"Lanjut →"** di kanan bawah — validasi field step aktif dulu sebelum maju
- Tombol **"← Kembali"** di kiri bawah — selalu ada kecuali di step 1
- Step selesai (✓) di step bar bisa diklik langsung untuk loncat kembali — tanpa validasi (navigasi mundur selalu bebas)
- Tombol "← Kembali" juga tidak menjalankan validasi — selalu berhasil
- Step yang belum pernah dicapai tidak bisa diklik dari step bar

### Validasi Per Step

Validasi dijalankan hanya untuk field di step aktif saat menekan "Lanjut". Gunakan `form.trigger([...fieldNamesInStep])` dari react-hook-form. Jika ada error, tampilkan inline dan blokir kemajuan.

Field per step yang divalidasi:
- Step 1: `title`, `summary`, `descriptionHtml`  
  (sampul divalidasi secara terpisah — file input di luar RHF)
- Step 2: `startAtIso`, `endAtIso`, `venueId`, `linkedVenueMenuItems`
- Step 3: `pricingSource`, `ticketMemberPrice`, `ticketNonMemberPrice`, `menuMode`, `menuSelection`, `voucherPriceIdr`
- Step 4: `picAdminProfileId`, `bankAccountId`

Submit hanya terjadi di step 4. Form state (RHF) tetap memegang semua field di semua step — tidak ada state split per step.

### Sampul (step 1)

Upload sampul wajib untuk create baru. Validasi sampul dilakukan saat klik "Lanjut" di step 1: jika `coverFile` masih `null`, tampilkan error message di bawah input file.

---

## Edit — Tabs

- 4 tab dengan label sama persis dengan step names
- Semua tab bisa diklik kapan saja (tidak ada lock)
- Tombol **"Simpan perubahan"** selalu tersedia di setiap tab — menyimpan **semua field** (bukan hanya field di tab aktif), sama persis dengan perilaku sekarang
- Dialog konfirmasi sensitive changes (harga, PIC, rekening) tetap berjalan seperti sekarang
- Tidak ada perubahan pada logika submit/action — hanya tampilan yang berubah

### Komponen Tabs

Gunakan komponen `Tabs` yang sudah ada di `src/components/ui/tabs.tsx`. Struktur:

```tsx
<Tabs defaultValue="info">
  <TabsList>
    <TabsTrigger value="info">① Info Dasar</TabsTrigger>
    <TabsTrigger value="jadwal">② Jadwal & Venue</TabsTrigger>
    <TabsTrigger value="tiket">③ Tiket & Menu</TabsTrigger>
    <TabsTrigger value="pic">④ PIC & Rekening</TabsTrigger>
  </TabsList>
  <TabsContent value="info">...</TabsContent>
  ...
</Tabs>
```

---

## Arsitektur Komponen

### Refactor `EventAdminForm`

`EventAdminForm` tetap sebagai satu komponen yang memegang semua state (RHF form, step, coverFile, dsb). Bagian yang berubah:

1. Tambah state `currentStep: 1 | 2 | 3 | 4` (hanya untuk mode create)
2. Tambah state `completedSteps: Set<number>` untuk track step yang sudah valid
3. Render kondisional per step — hanya section yang relevan yang ditampilkan
4. Tombol navigasi berubah per step

Tidak perlu membuat komponen stepper baru yang kompleks. Implementasi inline di `EventAdminForm` cukup — logika stepper sederhana (4 step tetap).

`completedSteps` bertambah hanya saat user berhasil menekan "Lanjut" dan validasi lolos — bukan saat step sekadar dikunjungi.

### StepIndicator (sub-komponen)

Buat sub-komponen kecil `StepIndicator` di dalam file yang sama:

```tsx
function StepIndicator({ steps, currentStep, completedSteps, onStepClick }) { ... }
```

Props:
- `steps`: array label string
- `currentStep`: nomor step aktif (1-based)
- `completedSteps`: `Set<number>`
- `onStepClick(step: number)`: dipanggil hanya jika step ada di `completedSteps`

### Pemisahan Section Content

Extract setiap section menjadi blok JSX terpisah (bukan komponen — cukup variabel atau conditional render) agar `EventAdminForm` tidak semakin panjang tak terkendali. Alternatif: pisahkan ke file terpisah `event-admin-form-sections.tsx` jika file terlalu besar setelah refactor.

---

## Data Flow

```
EventAdminForm (holds all RHF state)
  ├── StepIndicator (visual only, calls onStepClick)
  ├── [Step content rendered conditionally]
  │     └── Field sections (reuse existing JSX)
  └── Navigation buttons (Kembali / Lanjut / Submit)
```

Form state tidak pernah reset saat pindah step — user bisa bebas kembali ke step sebelumnya tanpa kehilangan data.

---

## Error Handling

- Error validasi per field tetap ditampilkan inline (RHF `formState.errors`)
- Jika "Lanjut" ditekan tapi ada error di step aktif: scroll ke error pertama, blokir navigasi
- Root error (dari server action) tetap ditampilkan di atas form, terpisah dari stepper
- Untuk edit mode, error handling tidak berubah dari implementasi sekarang

---

## Hal yang Tidak Berubah

- Logika server action `createAdminEvent` dan `updateAdminEvent` — tidak ada perubahan
- Schema validasi `adminEventUpsertSchema` — tidak ada perubahan
- Dialog konfirmasi sensitive changes di edit mode
- Lock field saat ada registrasi (`lockedMenuKeys`) — tetap berlaku per field, hanya posisinya di step berbeda
- Semua field yang ada sekarang — tidak ada yang dihapus atau ditambah
