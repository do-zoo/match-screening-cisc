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

## Draft & Resume (Server-Side)

### Status Flow Baru

```
draft (incomplete) → ready (semua step selesai) → active (tayang) → finished
```

| Status   | Arti                                             | Siapa yang bisa set            |
|----------|--------------------------------------------------|--------------------------------|
| `draft`  | Event belum lengkap (masih dalam stepper)        | Sistem otomatis saat step 1 ✓  |
| `ready`  | Semua step selesai, menunggu dipublish           | Sistem otomatis saat step 4 ✓  |
| `active` | Event sudah tayang / publik                      | Owner atau Admin               |
| `finished` | Event selesai                                  | Owner atau Admin               |

`ready` adalah nilai baru di `EventStatus` enum — butuh **satu Prisma migration** yang juga mencakup perubahan berikut (lihat bagian Schema Changes).

### Kapan Event Dibuat di DB

Event dibuat pertama kali saat user menekan "Lanjut" di **step 1** dan validasi lolos (title, summary, descriptionHtml valid + coverFile tidak null). Setelah ini:

- URL berubah dari `/admin/events/new` ke `/admin/events/[eventId]/edit`
- Halaman edit mendeteksi event belum lengkap → tetap tampilkan **stepper** (bukan tabs)
- Step 2–4 masing-masing menjalankan PATCH/update pada event yang sudah ada

Saat step 4 submit berhasil:
- Status berubah dari `draft` → `ready`
- Halaman edit berganti tampilan ke **tabs** (mode edit normal)

### Schema Changes (Prisma Migration)

Satu migration mencakup semua perubahan berikut:

1. **Tambah `ready` ke `EventStatus` enum**
2. **`picAdminProfileId String` → `String?` (nullable)** — field ini adalah FK ke `AdminProfile`. Saat event dibuat di step 1, PIC belum diisi sehingga harus nullable. `bankAccountId` juga sama: `String` → `String?`.
3. **Tambah `createdByAdminProfileId String?`** — FK ke `AdminProfile`, untuk tracking siapa yang memulai create (dipakai untuk banner di `/admin/events/new`). Nullable agar event lama tidak terpengaruh.

Relasi yang perlu diupdate di schema:
```prisma
picAdminProfileId   String?
picAdminProfile     AdminProfile? @relation(...)
bankAccountId       String?
bankAccount         PicBankAccount? @relation(...)
createdByAdminProfileId String?
createdByAdmin      AdminProfile? @relation(...)
```

### Deteksi "Belum Selesai"

Event dianggap **incomplete** jika:
```
event.status === 'draft' && event.picAdminProfileId === null
```

`picAdminProfileId` hanya terisi (non-null) setelah step 4 selesai. Event `draft` yang dibuat dari form lama tidak terpengaruh karena mereka sudah memiliki `picAdminProfileId` non-null.

### Edit Page — Deteksi Mode

`/admin/events/[eventId]/edit` menentukan tampilan berdasarkan kelengkapan event:

```
isIncomplete = event.status === 'draft' && event.picAdminProfileId === null

isIncomplete → tampilkan Stepper (resume create flow)
!isIncomplete → tampilkan Tabs (edit normal)
```

Saat resume stepper, form diisi dari data event yang sudah ada (`defaults` dari DB). User bisa navigasi mundur ke step sebelumnya (step ✓ bisa diklik) dan melanjutkan dari step yang belum selesai.

Menentukan step awal saat resume: validasi semua step secara silent saat load — step pertama yang gagal validasi adalah step awal yang ditampilkan.

### Publish

Tombol "Publish" mengubah status `ready` → `active`. Tersedia di:
- Halaman daftar acara (`/admin/events`) — di baris event dengan status `ready`
- Edit page (tab ④ PIC & Rekening, atau header edit page)

Hanya Owner dan Admin yang bisa publish (sama dengan permission buat acara).

### Resume di Events List (`/admin/events`)

Event dengan `status === 'draft' && picAdminProfileId === null` ditampilkan dengan:
- Badge **"Belum selesai"** (warna kuning/warning)
- Tombol/link **"Lanjutkan"** → menuju `/admin/events/[eventId]/edit` dalam mode stepper

### Banner di Halaman New (`/admin/events/new`)

Saat admin membuka halaman buat acara baru, sistem mengecek apakah ada event `draft` incomplete yang **dibuat oleh admin ini** (berdasarkan session). Jika ada:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Ada draft belum selesai: "Gala Dinner CISC 2026"    │
│  [Lanjutkan draft]          [Mulai baru]                 │
└─────────────────────────────────────────────────────────┘
```

"Lanjutkan draft" → redirect ke `/admin/events/[eventId]/edit` (stepper mode).  
"Mulai baru" → tutup banner, lanjut ke stepper baru. Draft lama **tidak dihapus** — tetap ada di daftar acara sebagai "Belum selesai" dan bisa dilanjutkan dari sana.

Banner hanya muncul untuk **satu draft terbaru** (berdasarkan `createdAt` desc). Jika ada multiple incomplete draft, hanya yang terbaru ditampilkan.

Untuk tracking "siapa yang membuat event", gunakan field yang sudah ada atau tambahkan `createdByAdminProfileId` ke Event. Ini diperlukan agar banner hanya muncul untuk draft milik admin yang sedang login.

> **Catatan:** `createdByAdminProfileId` ditambahkan di migration yang sama. Lihat bagian Schema Changes.

---

## Hal yang Tidak Berubah

- Logika server action `createAdminEvent` dan `updateAdminEvent` — tidak ada perubahan
- Schema validasi `adminEventUpsertSchema` — tidak ada perubahan
- Dialog konfirmasi sensitive changes di edit mode
- Lock field saat ada registrasi (`lockedMenuKeys`) — tetap berlaku per field, hanya posisinya di step berbeda
- Semua field yang ada sekarang — tidak ada yang dihapus atau ditambah
