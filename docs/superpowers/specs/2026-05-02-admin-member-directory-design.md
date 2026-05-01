---
title: Admin — direktori anggota (MasterMember CRUD & impor CSV)
date: 2026-05-02
project: match-screening
status: approved-in-chat
---

## 1) Purpose

Memberikan area admin untuk **mengelola direktori** `MasterMember`: pencarian, **CRUD per anggota**, dan **impor CSV** dengan semantik upsert parsial serta hasil **best effort** + laporan baris gagal — tanpa portal login bagi anggota di cakupan ini.

## 2) Scope

### 2.1 In scope

- Rute utama: **`/admin/members`** (daftar + pencarian + impor + tambah; edit lewat dialog atau pola setara di halaman yang sama).
- Server Actions untuk create, update, dan impor CSV; semua memanggil **`guardOwnerOrAdmin()`** dan mengembalikan **`ActionResult<T>`** (pesan galat dalam Bahasa Indonesia).
- Template unduhan CSV (header + contoh baris) opsional di v1 namun **disarankan** agar operator tidak menebak kolom.
- Parser & normalisasi boolean / upsert / partial update sesuai bagian 5.

### 2.2 Out of scope (YAGNI v1)

- Portal atau autentikasi **anggota** (pengguna publik).
- **Audit log** tersimpan di DB (hanya `updatedAt` bawaan model jika relevan untuk tampilan).
- **Ekspor** penuh direktori ke CSV (boleh ditambah kemudian; tidak wajib v1).
- Mengubah **`memberNumber`** setelah record dibuat.
- Perubahan skema Prisma kecuali terbukti wajib (target: **tanpa migrasi** v1).

## 3) Locked product decisions

| Topic | Decision |
|--------|-----------|
| Akses | **Owner** dan **Admin** saja (`guardOwnerOrAdmin`). Verifier/Viewer **tidak** mengakses modul ini. |
| Impor v1 | **Wajib** di UI bersama CRUD dan pencarian. |
| Hasil impor | **Best effort**: baris valid diterapkan; baris gagal dilaporkan; DB tidak di-rollback untuk baris yang sudah sukses. |
| Upsert | `member_number` (CSV) / `memberNumber` (DB) sebagai **kunci unik**; ada → **update** parsial; tidak ada → **create** jika syarat create terpenuhi. |
| Sel kosong (CSV) | **Partial update**: sel kosong = **jangan ubah** field tersebut di DB. |
| Duplikat nomor dalam satu file | **Baris pertama** dengan nomor itu diproses; baris berikutnya dengan nomor sama → **gagal** dengan alasan duplikat internal file. |
| Edit manual | `memberNumber` **read-only** setelah dibuat. |

## 4) UI & information architecture

### 4.1 Navigasi

- Item menu admin baru menuju `/admin/members` (label contoh: **Anggota** atau **Direktori anggota**), ditempatkan konsisten dengan IA admin yang ada (mis. master data / komite).

### 4.2 Daftar

- Tabel: minimal `memberNumber`, `fullName`, `whatsapp`, indikator **Aktif/Nonaktif**, **Pengurus**, **Boleh PIC**, opsional `updatedAt`.
- **Filter cepat**: Semua / Hanya aktif / Hanya nonaktif (default **Semua**).
- **Pencarian** satu kolom: cocokkan substring (case-insensitive) pada `memberNumber` dan `fullName`.

### 4.3 Form

- **Tambah**: field selaras model; `memberNumber` wajib; boolean default selaras default Prisma kecuali produk memutuskan lain secara eksplisit di implementasi.
- **Edit**: sama kecuali `memberNumber` tidak dapat diedit; penonaktifan via `isActive` dengan copy yang menjelaskan bahwa data tetap untuk riwayat.

### 4.4 Impor (satu halaman dengan daftar)

1. Pilih file + **Unggah & proses**.
2. Ringkasan: jumlah berhasil / gagal (Bahasa Indonesia).
3. Jika ada gagal: **Unduh CSV error** (kolom minimal: `baris`, `member_number`, `full_name`, `alasan` — lihat §5.4).
4. Refresh daftar setelah selesai (otomatis atau tombol muat ulang).

### 4.5 PIC & registrasi (edge)

- Menonaktifkan anggota tidak menghapus baris; relasi ke acara (PIC) mengikuti aturan FK yang ada (**Restrict** pada PIC). v1: **teks bantuan generik** saat menonaktifkan sudah cukup; query “masih PIC acara aktif” bersifat opsional peningkatan jika murah.

## 5) CSV specification

### 5.1 File

- Format **CSV**, delimiter koma, encoding **UTF-8**; **BOM** diperbolehkan.
- Baris 1 = **header** wajib dengan nama kolom tetap (implementasi menetapkan daftar persis, mis. snake_case).

### 5.2 Kolom v1

| Kolom CSV | Field DB | Create baru | Update |
|------------|-----------|-------------|--------|
| `member_number` | `memberNumber` | Wajib terisi | Wajib terisi |
| `full_name` | `fullName` | Wajib terisi (non-kosong setelah trim) | Kosong = tidak ubah; terisi = update |
| `whatsapp` | `whatsapp` | Opsional | Kosong = tidak ubah |
| `is_active` | `isActive` | Opsional (default DB jika tidak diset lewat baris) | Hanya ubah jika sel berisi token boolean yang dikenali (§5.3) |
| `is_pengurus` | `isPengurus` | idem | idem |
| `can_be_pic` | `canBePIC` | idem | idem |

**Create:** jika `member_number` belum ada dan `full_name` kosong atau hanya spasi setelah trim → baris **gagal**.

### 5.3 Boolean

Dikenali sebagai true: `true`, `1`, `yes`, `y`, `iya`.  
Dikenali sebagai false: `false`, `0`, `no`, `n`, `tidak`.  
Perbandingan case-insensitive setelah trim.  
Sel kosong atau teks lain → pada **update** berarti **jangan ubah**; pada **create** tidak memaksa nilai (biarkan default DB) kecuali kolom wajib create melanggar aturan lain.

### 5.4 Laporan error

- Setiap baris gagal menghasilkan satu entri di file unduhan.
- **`baris`**: nomor baris dalam file **fisik** yang diunggah (baris 1 = header), sehingga operator dapat menemukan baris di spreadsheet.
- **`alasan`**: Bahasa Indonesia, spesifik (validasi, duplikat dalam file, format boolean tidak dikenali jika dianggap fatal untuk sel tersebut, dll.).

### 5.5 Batas unggahan

- Batas keras ukuran/ jumlah baris ditetapkan di implementasi untuk mencegah timeout (target awal: **≤ 5.000 baris data** atau **≤ 2 MiB** file, mana yang lebih ketat—sesuaikan setelah uji di lingkungan deployment).  
- Melampaui batas → **galat root** pada aksi impor, **tanpa** commit parsial.

### 5.6 Galat parse / bukan CSV

- Gagal parse atau bukan konten tabular yang dapat dibaca → **tidak ada** mutasi DB, `rootError` dalam Bahasa Indonesia.

## 6) Architecture notes

- Satu modul server-side (fungsi atau layanan kecil) yang mengenkapsulasi **aturan upsert + partial field** agar perilaku impor dan form tidak divergen.
- Pola error: `isAuthError` untuk “Tidak diizinkan.” seperti server action admin lain.

## 7) Testing direction

- **Unit**: normalisasi boolean; pemetaan “sel kosong → skip update”; skenario create tanpa `full_name` → gagal.
- **Unit / integration**: upsert create lalu update parsial; duplikat `member_number` dalam satu file; campuran baris sukses dan gagal memastikan partial success.
- **Integration** (opsional): impor file melebihi batas keras → gagal tanpa perubahan.

## 8) Resolved ambiguities (self-review)

- Nomor baris di laporan error = **nomor baris file**, header di baris 1.
- v1 tidak mendefinisikan pembulatan “last wins” untuk duplikat internal file; hanya **first processed wins**.
- Template unduhan disarankan; jika tidak sempat di PR pertama, dokumentasi kolom di UI impor menjadi wajib minimum.
