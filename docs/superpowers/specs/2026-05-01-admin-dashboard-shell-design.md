---
title: Admin dashboard home + konsisten admin shell UI
date: 2026-05-01
project: match-screening
status: approved-in-chat
---

## 1) Purpose

PIC admin saat ini tiba di **`/admin`** pada layar sangat minim (email + role), tanpa akses cepat ke event atau navigasi konsisten menuju **inbox** / **laporan**. Spesifikasi ini mendefinisikan:

1. **Shell admin bersama** (sidebar responsif / drawer mobile, landmark semantik, breadcrumb/hal judul jalur dalam) untuk semua halaman di bawah **`/admin/*`**.
2. **Dashboard `/admin`** sebagai **beranda PIC**: kartu per event dengan ringkasan beban kerja dan tautan utama ke **Inbox** dan **Laporan**.

Bahasa UI untuk PIC yang ditampilkan di permukaan baru: **Bahasa Indonesia**.

## 2) Scope

### 2.1 In scope

- **`src/app/admin/layout.tsx`** — kerangka navigasi bersama untuk child routes admin.
- **`src/app/admin/page.tsx`** — dashboard beranda: filter status event, rekap gabungan opsional, grid kartu event + metrik.
- **Modul pemuatan data** (nama mengikuti gaya ada, mis. `load-admin-dashboard` di **`src/lib/...`**) yang menggabungkan **filter akses event** sama dengan **`canVerifyEvent`** dan agregasi hitungan **`Registration`** per status yang diperlukan.
- Wiring **Link** ke pola URL ada: **`/admin/events/{eventId}/inbox`** dan **`/admin/events/{eventId}/report`**.

### 2.2 Out of scope (YAGNI)

- CRUD **`Event`** dari admin atau alur baru kelola PIC/bank/event.
- Grafik historis / analytics lanjutan di dashboard (tetap memakai halaman laporan untuk detail).
- **Migrasi schema** baru.
- Sidebar berisi daftar lengkap scroll semua event (daftar utama tetap di dashboard, bukan sidebar penuh).
- Perubahan kebijakan **`canVerifyEvent`** itu sendiri — hanya **konsumsi** pola yang sama.

## 3) Locked product decisions

| Topic | Decision |
|--------|-----------|
| Rangka kerja utama (dari brainstorming) | **C**: Dashboard beranda **dan** shell admin dalam satu rangkaian. |
| Definisi “Menunggu tindakan” (kartu + rekap) | Hanya count **`pending_review`** (strict). **`submitted`** dan **`payment_issue`** tidak termasuk KPI utama ini (tetap terlihat lewat inbox/laporan operasional). |
| Rekap atas daftar kartu | **Ya**: satu ringkasan agregat **total `pending_review`** di seluruh event yang user boleh akses (label konsisten dengan “menunggu tinjauan”). |
| Filter status event pada dashboard | Tab/pill **Semua · Aktif · Draf · Selesai**; **default: Aktif** (`EventStatus.active`). |
| Kartu event — aksi | **Ya**: **Inbox** (primer) + **Laporan** (sekunder), selaras pola link inbox → laporan hari ini. |
| Sidebar — daftar event | **Tidak** sebagai daftar penuh; hanya tautan struktural (mis. **Beranda**) + konteks halaman; detail event dari dashboard. |

## 4) Data & authorization

### 4.1 Sumber konteks PIC

`getAdminContext(session.user.id)` → `{ role, helperEventIds }` (tidak mengubah kontrak).

Per event **`E`**, dashboard/include query hanya boleh memuat data jika **`canVerifyEvent(ctx, E.id)`**:

- **`Owner`** / **`Verifier`**: semua event di basis data (untuk PIC ini).
- **`Viewer`**: hanya **`eventId ∈ helperEventIds`**.

### 4.2 Urutan daftar event (default)

Kelompok menurut relevansi operasional:

1. `active`
2. `draft`
3. `finished`

Di dalam tiap kelompok, urut **`startAt`** sehingga PIC melihat agenda terdekat dulu (mendatang / terbaru secara konsisten—implementasi pakai pola tunggal: mis. **`startAt` ascending** dalam tiap kelompok agar berikutnya kronologis).

### 4.3 Metrik per kartu

Minimal:

| Kolom VM | Makna |
|----------|--------|
| `pending_review` | Count registrasi **`status === pending_review`**. (**Label UI: Menunggu tindakan**) |
| `approved` | Count **`status === approved`**. |
| `total` | Total registrasi untuk event tersebut (semua status). |

Tidak wajib menampilkan `rejected` / `cancelled` / `refunded` di kartu pertama.

### 4.4 Agregasi rekap atas daftar

- **`sum(pending_review)`** pada himpunan event yang lolos filter **tab** (lihat §5) **dan** filter akses — agar angka “beban hari ini” cocok dengan kartu yang terlihat.

### 4.5 Query quality

- Hindari **N+1** count per kartu: prefer **`findMany` event** yang diizinkan + **`groupBy`** (atau satu query agregat setara) pada **`Registration`** dengan **`where: { eventId: { in: [...] } }`** per status yang dibutuhkan, lalu gabungkan di memori menjadi ViewModel kartu.

## 5) Behaviour & UI shell

### 5.1 Layout admin

- **`nav`** sidebar kiri tetap pada **breakpoint besar** (~`lg`).
- Pada **mobile**: sidebar sama isinya tetapi disajikan sebagai **drawer/sheet**; tombol pembuka ☰ **`aria-label`** jelas (mis. “Menu admin”), sentuh minimal **44×44** px.
- **Header jalur dalam** halaman dalam: breadcrumb **`Beranda › {judul ringkas event} › Inbox`** (dll.) diturunkan dari pathname; hindari breadcrumb bertele-tele untuk `/admin` itu sendiri.
- Lebar konten selaras pola ada: **`max-w-6xl`** konsisten dengan inbox; padding **`px-6 py-*`** menyelaraskan halaman lain admin.

### 5.2 Dashboard konten

1. Heading **Dashboard** (+ identitas singkat PIC jika berguna dipangkas satu baris).
2. Bar rekap (**opsional tetapi disetujui**): **“X registrasi menunggu tinjauan”** (hanya **`pending_review`**, atas event dalam filter aktif tab + hak akses).
3. Filter status event: **Semua \| Aktif \| Draf \| Selesai**; default **`Aktif`**.
4. Grid kartu responsif (1 → 2 → 3 kolom).
5. Kartu: judul, badge status event, **`startAt`** (+ venue satu baris opsional); angka **Menunggu tindakan** menonjol; **`Disetujui`** dan **`Total`** lebih sekunder; CTA **Buka inbox**, link **Laporan**.

### 5.3 Sampul event

Cover mini **opsional** fase dua jika mempengaruhi performa/layout; jika digunakan: **`loading="lazy"`** + dimensi/`aspect-ratio` tetap (**CLS < 0.1** sasaran).

## 6) Failure & empty states

| Situasi | Perilaku |
|---------|-----------|
| Tidak ada `AdminProfile` | Sama pola inbox kini: blok peringatan (copy Indonesia setara **Missing AdminProfile**); jangan jalankan aggregasi sensitif. |
| `AdminProfile` ada, tetapi **tidak ada event** setelah filter akses | **Empty state** berisi penjelasan (Viewer tanpa tugas helper, dll.). |
| Sesi hilang | Tetap bergantung **middleware/`proxy`** → `/admin/sign-in` (tidak mengubah kontrak sekarang). |
| Deep link ke resource tanpa izin | Tetap **`notFound()`**. |
| Kegagalan database | Fallback error UI atau error boundary tidak membisu; menyebut gagal muat sarankan percobaan ulang. |

## 7) Technical notes

### 7.1 Code organisation

- Satu entry loader Prisma-canonical (**mis.** `loadAdminDashboard(authUserId)` atau `ctx`) menghasilkan **ViewModel stabil** untuk page + unit test helpers murni bila berguna untuk merge counts.
- **Server Components only** untuk data fetching; tidak perlu `'use client'` di lapisan agregasi.

### 7.2 Sign out (“Keluar”)

Repo belum punya pola UI **Keluar** terlihat dari pencarian singkat pada saat penulisan spesifikasi shell disetujui. Desain mencakup **slot footer** atau item nav **Keluar**; implementasi harus menyelaraskan **`authClient.signOut()`** Better Auth / pola resmi dokumentasi **`src/lib/auth`**, bisa sebagai satu tugas eksplisit dalam rencana implementasi jika belum ada.

## 8) Testing

- **Unit test** pada fungsi **murni** yang menggabungkan hasil Prisma/mock menjadi bentuk kartu + rekap (edge: nol event, beberapa event, count nol semua status).
- **Tidak** mensyaratkan E2E browser untuk fase ini.

## 9) Success criteria

- PIC **Owner / Verifier** membuka **`/admin`** dan melihat event relevan dengan metrik konsisten serta pintasan **Inbox** dan **Laporan**.
- PIC **Viewer** hanya melihat event helper yang diizinkan; tanpa akses kosong mengherankan.
- Angka **“Menunggu tindakan”** sama definisinya dengan count **`pending_review`** saja di semua kartu dan rekap.
- Semua halaman admin utama **berbagi** shell navigasi yang sama (mobile usable, fokus terlihat).

## 10) Follow-ups (not in this spec)

- KPI sekunder untuk `payment_issue` / `submitted` di kartu atau badge inbox.
- Thumbnail cover event di kartu dengan pipeline gambar konsisten **`next/image`** bila Cocok CSP/domains Blob.
- Pencarian global registrasi lintas event (butuh UX + indexing terpisah).
