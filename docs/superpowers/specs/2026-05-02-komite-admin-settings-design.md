# Desain: Komite & admin (Pengaturan) — UX, pengelolaan in-app, transparansi

**Tanggal:** 2026-05-02  
**Status:** disetujui konsep (pemangku kepentingan menyetujui §1–§5; satu halaman tanpa pemecahan rute).

## 1. Konteks

Halaman **`/admin/settings/committee`** saat ini hanya menampilkan tabel baca-saja `AdminProfile` + nama/email dari Better Auth **`User`**, dengan penjelasan bahwa PIC, rekening bank, **`canBePIC`**, dan data master lain berada di **`/admin/members`**. Perubahan admin dilakukan lewat **`pnpm bootstrap:admin`** hingga modul interaktif tersedia.

Seluruh area **Pengaturan** komite dilindungi **`canManageCommitteeAdvancedSettings`** (hanya **Owner**).

## 2. Tujuan

| Kode | Tujuan |
|------|--------|
| **A** | Owner mengelola **AdminProfile** di dalam aplikasi: menambah (untuk akun yang sudah ada), mengubah peran, mengatur opsional **`memberId`**. |
| **B** | Memperjelas **IA dan copy**: sumber kebenaran PIC/rekening vs identitas akses admin; CTA ke Anggota; tidak menduplikasi form Anggota. |
| **C** | **Transparansi operasional ringkas**: indikator 2FA (`User.twoFactorEnabled`), aktivitas sesi terbaru (satu timestamp per akun dari agregasi `Session`), konsisten dengan prinsip privasi (tanpa menampilkan IP/user agent pada MVP ini). |

## 3. Bukan ruang lingkup (YAGNI)

- Mengirim undangan email / magic link otomatis untuk membuat akun baru dari halaman ini (orang harus sudah punya **`User`** lewat alur masuk yang ada).
- Mengganti Better Auth enrol 2FA penuh (tetap lewat pola akun/UI yang sudah atau akan ditambahkan terpisah); halaman ini hanya **menampilkan** status.
- Mengedit **`MasterMember`** (PIC, bank, dll.) dari halaman ini.
- Menampilkan **IP** atau **User-Agent** sesi pada tabel utama.

## 4. Rekomendasi pendekatan

**Phased dalam satu rencana implementasi:** perkuat **B** + **C** pada tabel yang sama, lalu tambah mutasi **A** dengan **`guardOwner`**, **`ActionResult`**, dan **`ClubAuditLog`**.

Alternatif yang ditolak:

- **CRUD sekaligus tanpa fase** — risiko edge case Owner terakhir dan audit tidak selesai.
- **Hanya B + C** — tidak memenuhi kebutuhan **A**.

## 5. Perilaku fungsional

### 5.1 Menambah admin

1. Owner memasukkan **email** (unik di `User`).
2. Jika **tidak ada** `User` dengan email tersebut: pesan kesalahan bahasa Indonesia yang jelas (akun harus sudah pernah terdaftar / masuk).
3. Jika ada `User` dan **sudah** punya `AdminProfile`: pesan bahwa admin sudah terdaftar.
4. Jika ada `User` tanpa `AdminProfile`: buat baris dengan peran default **Viewer**; audit.

### 5.2 Mengubah peran

- Select **Owner | Admin | Verifier | Viewer** dengan validasi: **minimal satu Owner** tetap ada setelah perubahan (blokir demosi atau penghapusan yang akan melanggar ini).

### 5.3 Hubungan ke anggota

- **`memberId`** boleh di-set atau dikosongkan (lookup **`MasterMember`** mengikuti pola UI admin yang ada).
- Rekening PIC dan flag PIC tetap dikelola di **Anggota**.

### 5.4 Menghilangkan akses bermakna (MVP)

- **Disarankan:** turunkan ke **Viewer** dan **lepaskan `memberId`**, daripada menghapus `AdminProfile`, agar konsistensi dengan akun Auth dan jejak audit sederhana.
- Jika di masa depan diperlukan penghapusan profil, itu menjadi perubahan terpisah dengan analisis FK dan audit.

### 5.5 Transparansi (C)

- **2FA aktif:** tampilkan dari **`User.twoFactorEnabled`** (boolean; null/false sama-sama ditampilkan sebagai tidak aktif jika itu konvensi kode).
- **Aktivitas terbaru:** satu **`DateTime`** per `authUserId`, misalnya **`max(session.updatedAt)`** untuk semua sesi non-kadaluarsa, dengan fallback dokumentasi jika tidak ada sesi (**"—"`** atau "Belum ada sesi").
- Tidak menyalin token sesi atau data sensitif ke metadata audit untuk keperluan kolom ini.

### 5.6 Audit konfigurasi

Aksi baru (nama stabil, snake-ish konsisten dengan yang ada):

- Pembuatan profil dari UI (bukan bootstrap): mis. **`admin_profile.created`** atau reuse **`ADMIN_PROFILE_*`** dengan sufiks jelas dari bootstrap.
- Perubahan peran: **`admin_profile.role_changed`** dengan metadata **`fromRole`**, **`toRole`**, **`targetAuthUserId`** (sanitized).
- Perubahan **`memberId`**: **`admin_profile.member_link_changed`** (atau gabungan satu aksi **`admin_profile.updated`** dengan metadata terstruktur), tanpa menyimpan nama penuh anggota bila itu dianggap sensitif berlebihan — minimal ID/referensi.

Semua ditulis lewat **`appendClubAuditLog`** (atau helper setara), dengan pola sanitasi sama seperti penyimpanan lain.

Script **`bootstrap-admin`** boleh tetap menulis **`ADMIN_PROFILE_BOOTSTRAP_UPSERT`** seperti sekarang; tidak wajib mengubah behaviour kecuali untuk konsistensi audit.

### 5.7 Keamanan

- Loader halaman dan setiap mutasi memverifikasi **Owner** (setara **`guardOwner`** / **`canManageCommitteeAdvancedSettings`**).
- URL langsung oleh non-Owner tetap **`notFound()`** lewat layout yang ada.

## 6. Antarmuka (satu halaman)

- Pertahankan **`/admin/settings/committee`** sebagai satu halaman: tabel ditingkatkan + blok penjelasan **B** di atasnya.
- Aksi (**tambah**, **edit peran**, **edit tautan anggota**, **cabut akses bermakna**) melalui **dialog** atau **sheet** konsisten dengan komponen admin lain (mis. pola Base UI Dialog jika sudah menjadi standar modul tersebut).
- Teks bantuan: alur umum (*anggota ada di direktori → pengguna punya akun login → Owner menambahkan di sini*).

Perbarui teks kartu hub **`/admin/settings`** untuk kartu **Komite & admin** agar menekankan **pengelolaan admin aplikasi**, bukan rekening PIC.

## 7. Pengujian

- **Unit:** invariant **Owner terakhir**; mapping guard Owner.
- **Unit/integration ringkas:** server action sukses/gagal (email tidak ada, duplikat profil, demosi Owner terakhir).
- Pola **`ActionResult`** dengan pesan akar bahasa Indonesia.

## 8. Ketergantungan

- Prisma: **`AdminProfile`**, **`User`**, **`Session`**.
- Tidak ada migrasi schema wajib untuk MVP **C** jika agregasi sesi dilakukan lewat query; jika kinerja menjadi masalah pada skala besar, pertimbangkan materialized ringkasan pada iterasi berikut (di luar MVP ini).

## 9. Rilis berikutnya (opsional, tidak menghalangi MVP)

- Undangan email untuk user baru.
- Tampilan IP/UA bagi Owner dengan kebijakan retensi eksplisit.
- Pemecahan subtajuk statistik admin (tetap bukan pemecahan **rute** kecuali kebutuhan produk berubah).
