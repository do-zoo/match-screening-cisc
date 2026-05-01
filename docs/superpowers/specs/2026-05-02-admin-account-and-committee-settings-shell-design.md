---
title: Akun admin (dropdown + halaman penuh) + shell pengaturan komite
date: 2026-05-02
project: match-screening
status: ready-for-review
related:
  - 2026-05-02-admin-navigation-ia-v1-design.md
  - 2026-05-01-admin-dashboard-shell-design.md
---

## 1) Purpose

Mengunci desain untuk:

1. **Pengaturan pribadi per admin** — tanpa item sidebar baru; entri utama lewat **dropdown / zona pengguna** di chrome admin (“akun”).
2. **Preferensi aplikasi MVP** — **tema** **terang / gelap / ikuti sistem**, terintegrasi dengan token **`dark`** yang sudah digunakan di codebase.
3. **Pengaturan komite tingkat klub** — tetap **`/admin/settings`** (Owner-only seperti yang ada), tetapi pada lintasan pertama kali fitur ini: **kerangka UI bertab/bersection** saja (**tanpa** persistensi konfigurasi komite sampai iterasi berikutnya).

Dokumen ini melengkapi **[IA navigasi admin](2026-05-02-admin-navigation-ia-v1-design.md)** dan **[shell dashboard](2026-05-01-admin-dashboard-shell-design.md)**. Rute global **Anggota** dan **Pengaturan** di produk saat ini memakai path Inggris **`/admin/members`** dan **`/admin/settings`** (redirect permanen dari path legacy Indonesia); matriks dalam dokumen IA historis dapat berbeda — implementasi mengikuti kode.

## 2) Scope

### 2.1 In scope (MVP)

- **Dropdown akun** di header admin (desktop sidebar header + mobile header strip): ringkasan **email** + **nama tampilan** (jika ada), tautan **“Kelola akun…”** → **`/admin/account`**, dan **keluar** (penempatan pasti **Keluar** dibanding sidebar mengikuti satu pola konsisten saat implementasi).
- **Halaman penuh** **`/admin/account`**: form **nama tampilan** (dapat diedit), **email** **hanya baca** (sumber kebenaran dari sesi / Better Auth), kontrol **tema** tiga nilai (**light**, **dark**, **system**).
- **Provider tema** di **root layout** sehingga **seluruh aplikasi** (publik + admin) mengikuti preferensi — kecuali keputusan produk di masa depan membatasi tema hanya admin (bukan bagian MVP ini).
- **`/admin/settings`**: **Owner-only**; isi diganti dari satu placeholder tunggal menjadi **shell** dengan **beberapa tab atau section** yang masing-masing berisi **kartu placeholder** (teks Indonesia, border dashed) mencerminkan roadmap: PIC & admin aplikasi, rekening bank, harga default global, template WhatsApp (**tanpa** Server Action baru yang menulis konfigurasi komite dalam sprint ini).

### 2.2 Out of scope (MVP)

- Perubahan **alamat email** lewat formulir `/admin/account` (alur terpisah / Better Auth atau iterasi kemudian).
- **Notifikasi email** bergaya digest (toggle atau preferensi penyaringan).
- **Bahasa UI** dapat diganti (**i18n**).
- Persistensi tema atau nama di **`AdminProfile` / migration Prisma** — **tidak dipakai** pada MVP ini kecuali verifikasi teknis menemukan **`User.name`** tidak dapat diperbarui lewat Better Auth dalam konfigurasi repo; fallback yang diizinkan: tambah satu field atau dokumen revisi pendek sebagai ADR (**bukan** bagian kesepakatan desain utama).

### 2.3 Definisi selesai (acceptance, tingkat produk)

- Admin yang sah dapat membuka **`/admin/account`**, membaca email, mengubah **nama** dan **tema**, dan melihat hasil tema setelah navigasi antara publik dan admin.
- Pengguna tidak melihat item **Akun** di sidebar global selaras **§3**.
- **Owner** membuka **`/admin/settings`** dan melihat **beberapa bagian placeholder** konsisten bahasa Indonesia; pengguna lain mendapat perilaku **`notFound()`** / guard yang sama dengan halaman tersebut hari ini.
- Tidak ada regresi sign-in/sign-out atau layout admin utama.

## 3) Informasi arsitektur — navigasi & rute

| Konsep | Rute canonik | Item sidebar global? |
|--------|----------------|----------------------|
| Akun pengguna admin | **`/admin/account`** | **Tidak** — hanya dropdown header + tautan langsung opsional bookmark. |
| Pengaturan komite (lanjutan) | **`/admin/settings`** | **Ya** (**Pengaturan**, Owner-only) seperti IA. |
| Redirect legacy | **`/admin/pengaturan` → `/admin/settings`**, **`/admin/anggota` → `/admin/members`** | Sudah ada di **`next.config.ts`**; dokumentasi baru tidak mengharuskan link internal memakai path legacy. |

**Peran:** halaman **`/admin/account`** tersedia untuk **setiap pengguna yang lolos **`admin/layout`**** (punya **`AdminProfile`** atau konteks sama yang dipakai hari ini). Tidak ada filter role tambahan untuk membaca halaman akun pada MVP ini. Jika suatu masa **Viewer** harus dibatasi dari pengeditan nama, itu menjadi revisi eksplisit (bukan cakupan dokumen ini).

## 4) Pendekatan data & stack (yang disepakati)

### 4.1 Tema (**disarankan: tanpa kolom baru Prisma`)

- Tambah **`next-themes`** (atau setara kurang lebih setara perilaku yang disetujui tim) dengan **`ThemeProvider`** membungkus anak **`RootLayout`**.
- Mengatur **`class`** pada **`html`** (mis. **`dark`**) dan opsi penyimpanan **`localStorage`** + mitigasi FOUC (**`suppressHydrationWarning`** pada tag **`html`** selaras dokumentasi **`next-themes`**).
- Kompak penyaringan SSR + cookie dapat mengikuti resep resmi penyedia.

### 4.2 Nama tampilan

- **Sumber kebenaran MVP:** nama pada **Better Auth** **`User.name`** (model **`User`** di Prisma schema yang dipakai auth).
- Mutasi menyertai **pemanggilan API server Better Auth yang didukung** (disarankan **Server Action** yang terautentikasi, mengikuti pola **`guard*` / session** pada repo dibanding eksponen mentah tanpa pembungkus).
- **Validasi**: panjang bermakna, trim, pesan kesalahan **Bahasa Indonesia**.

### 4.3 Jika **`User.name` tidak dapat diperbarui** dalam konfigurasi berjalan

- **Plan B** (implementasi dokumentasikan satu baris ketika terjadi): field opsional **`displayName`** pada **`AdminProfile`** + migrasi; UI membaca gabungan (**`AdminProfile.displayName` ?? **`User.name`**) dalam urutan tertentu. Desain utama tetap Preferensi **Tanpa migration** (**§4.1–4.2**).

## 5) Pengaturan komite — kerangka tab/section (**tanpa** data)

Tab atau section bernama konsisten roadmap (huruf tepat bisa disesuaikan implementasi tetapi semantika tetap):

1. PIC & admin aplikasi (**menyusul**)  
2. Rekening bank & PIC (**menyusul**)  
3. Harga default global (**menyusul**)  
4. Template WhatsApp (**menyusul**)  

Masing-masing: judul deskriptif pendek + paragraf penjelasan + area dashed; **tidak** ada tombol simpan untuk konfigurasi komite sampai backlog modul tersebut.

## 6) Kesalahan & keamanan

- Server actions baru (nama) mengikuti pola **`ActionResult`** dan penyampaian gagal kepada pengguna Bahasa Indonesia.
- **`/admin/settings`** tetap memakai **`canManageCommitteeAdvancedSettings`** / pola **`notFound`** yang sama dengan halaman tersebut sekarang (**Owner-only**).

## 7) Pengujian

- **Vitest**: helper validasi nama (jika diekstrak ke modul murni).  
- Tema: bergantung integrasi penyedia — uji otomatis penuh **opsional**; verifikasi manual wajib sebelum klaim siap-merge.

## 8) Open points (titik eksplisit untuk rencana implementasi)

- Verifikasi **Better Auth**: endpoint / API yang digunakan untuk **`updateUser`** atau setara bagi **`name`**, serta apakah perlu plugin tambahan.
- Keputusan final apakah **Keluar** di desktop sidebar utama tetap seperti hari ini **atau** digabung ke dropdown untuk satu lokasi konsisten kedua breakpoints.
