# Pengaturan rekening PIC — Design Spec

**Date:** 2026-05-04  
**Status:** Approved

## Overview

Menambahkan **pengelolaan rekening pembayaran (`PicBankAccount`) dari UI admin** sebagai kelanjutan penyimpanan sekarang yang hanya disediakan lewat seed/DB langsung. Rekening dilekatkan ke **`AdminProfile`** (`ownerAdminProfileId`); **acara** memilih kombinasi **PIC** + **`bankAccountId`** yang valid.

Ruang lingkup MVP:

1. **CRUD (logis)** untuk rekening per profil dalam **konteks satu baris/expand pengaturan komite** — sub-komponen terpisah agar tidak membesarkan satu file secara tak terkontrol.
2. **Selaraskan form acara**: dropdown pemilihan rekening untuk **rekaman baru/pemilihan baru** hanya **rekening aktif** (`isActive: true`) milik PIC terpilih; validasi penyimpanan acara mencegah status akhir dengan **`bankAccount` nonaktif** tanpa paksaan ganti bagi operator.

**Tanpa migrasi schema** dalam MVP ini: kolom **`PicBankAccount`** yang ada (`bankName`, `accountNumber`, `accountName`, `isActive`) cukup.

---

## Kebijakan akses

| Aksi | Siapa |
|------|--------|
| Baca daftar/detail rekening suatu profil | Semua role yang sudah boleh mengakses area yang menampilkan blok tersebut (minimal **Verifier** dan **Viewer** untuk koordinasi, **tanpa tombol murasi**) |
| Tambah / ubah / nonaktifkan | **Pemilik profil itu** (**session** `AdminProfile` yang sama dengan `targetAdminProfileId`) **atau** **Owner / Admin** (sama pola “kelola orang lain” dengan fitur komite lain) |
| Hapus permanen | Ketentuan yang sama seperti mutasi lain; dibatasi pula oleh aturan FK (lihat di bawah) |

Jika pola guard routing/halaman pengaturan komite saat ini **tidak** memasukkan Verifier atau Viewer tetapi produk mengharuskan mereka **membaca** rekening di konteks tersebut, penyelarasan **satu definisi akses halaman/route** menjadi bagian pekerjaan implementasi ini (tanpa memberi mereka tombol tulis).

---

## UI — lokasi utama

- **Panel pengaturan komite** (`committee-admin-settings`): pada **expand/detail satu admin**, subsection **“Rekening pembayaran (PIC)”**.
- Konten:
  - Tabel atau daftar ringkas: nama bank, nama pada rekening, nomor rekening, status aktif/nonaktif.
  - Pemilik akses tulis: **Tambah**, **Ubah**, **Nonaktifkan**, **Hapus** (hapus ikut aturan).
  - Pemilik akses hanya-baca: tampilan identik tanpa kontrol mutasi.
- Penempatan utama mengikuti pilihan desain (**inline expand**). **Enhancement opsional kemudian:** tomboh yang membuka **Sheet/Dialog** dengan form yang sama jika UX mobile membutuhkannya — tanpa memindahkan “sumber kebenaran” dari konteks per profil.

---

## Siklus hidup data

### Nonaktifkan

- Set `isActive` ke `false`.
- Baris **`PicBankAccount`** dan referensi **`Event.bankAccountId`** yang sudah ada **tetap** (FK `Restrict` tidak dilanggar).
- Rekening nonaktif **tidak boleh** menjadi pilihan di dropdown **pemilihan rekening baru** pada form **buat/acara** setelah penyaringan ini diterapkan.

### Hapus permanen

- Hanya jika **tidak ada** baris **`Event`** dengan `bankAccountId` yang sama.
- Jika masih digunakan: server mengembalikan **`ActionResult`** gagal dengan **`rootError`** bahasa Indonesia yang menjelaskan bahwa acara masih menggunakan rekening tersebut (operator harus mengganti PIC/rekening di acara dulu atau hanya menonaktifkan).

### Ubah bank / nama / nomor

- Diperbolehkan untuk rekening yang sedang digunakan acara: perubahan **tercermin pada tampilan** yang membaca dari relasi langsung **`Event` → `PicBankAccount`** (tidak ada snapshot rekening di model acara). Operator harus menyadari bahwa **formulir publik** akan mengikuti nilai mutakhir).

---

## Form acara (selaraskan)

1. Pada pengambilan opsi untuk dropdown (route atau pola setara yang sudah ada, mis. `GET /api/admin/pic-banks/[adminProfileId]`): kembalikan hanya **`isActive: true`** untuk **daftar pilihan** saat menghubungkan **PIC baru** atau **menukar rekening**.
2. **`router.refresh`** / invalidasi pola yang konsisten dengan sisa admin setelah rekening diubah di panel komite, agar penyunting event tidak melihat opsi kedaluwarsa.
3. **Validasi server** pada penyimpanan acara (buat + ubah semua jalur yang memegang **`bankAccountId`**):
   - Jika **`bankAccountId`** mengacu rekening dengan **`isActive: false`** → gagal menyimpan dengan **`rootError`** bahasa Indonesia yang menginstruksikan pergantian PIC atau rekening aktif lain.
   - Tetap **`validatePicBankAndHelpers`** (atau nama setara): rekening harus **`ownerAdminProfileId`** sama dengan PIC acara (`picAdminProfileId`).

Ini **mengecualikan** skenario operator “meloloskan” pendaftar ke rekening yang sudah dimatikan; penalti operasional jelas dan dapat diperbaiki dengan mengaktifkan kembali rekening lama atau memilih pasangan PIC/rekening aktif.

---

## Server layer

- Tambah **server actions** khusus (mis. satu modul `admin-pic-bank-accounts`) yang:
  - Membuka dengan guard yang sama dengan admin actions lain (**`guardOwnerOrAdmin` / pola komite yang sudah dipakai**), plus **cek “profil sendiri atau Owner/Admin”** untuk target `ownerAdminProfileId`.
  - Mengembalikan **`ActionResult<T>`** konsisten dengan codebase; pesan gagal bahasa Indonesia.
- Operasi: **create**, **update** (field teks + tidak mengubah kepemilikan profil pemilik dalam MVP), **set inactive**, **delete** (pra-syarat: nol `Event`).
- Tidak menghapus pola API JSON yang ada jika masih berguna bagi klien klien; boleh **mereferensikan** query yang sama di action atau menyatukan sumber truth di satu helper Prisma untuk menghindari duplikasi filter `isActive`.

---

## Kesalahan & keamanan

- **Tidak** menambahkan pola baru untuk kontrol akses di luar kombinasi di atas.
- Nomor rekening adalah **data sensitif dalam konteks klub**: tampilan untuk pembaca (**Verifier/Viewer**) mengikuti keputusan akses ini; tidak memperbesar exposing ke luar admin auth.
- Unik kombinasi (nomor per profil atau global): **tidak diwajibkan dalam MVP** kecuali validasi sekunder muncul dari kebutuhan operasional; dapat ditambah iterasi dua jika terjadi duplikasi berbahaya di lapangan.

---

## Pengujian (disarankan)

1. Mutasi tertolak untuk **Verifier/Viewer**.
2. **Self** bisa mutasi sendiri; **Owner/Admin** bisa mutasi profil lain; non‑Owner/non‑Admin lain tidak bisa mutasi orang lain.
3. **delete** gagal ketika ada minimal satu **`Event`** dengan `bankAccountId` tersebut; berhasil ketika nol event.
4. **setInactive** kemudian **save event** tetap menggunakan `bankAccountId` tersebut → **server menolak** dengan `rootError`.
5. Endpoint/daftar pemilihan rekening PIC hanya mencantumkan **aktif**.

---

## Batas luar ruang lingkup (MVP)

- Halaman **pusat audit** (“semua rekening semua profil”) — tidak dibuat kecuali diminta kemudian.
- **Transfer kepemilikan** rekening antar-admin — tidak; rekaman tetap di `ownerAdminProfileId`; ganti PIC acara atas basis penugasan baru.
- **Masking/sebagian digit** nomor untuk subset role — bisa iterasi dua jika kebijakan privasi mensyaratkan.
