# Panduan User Acceptance Testing (UAT) — Dipakai Pengurus CISC

Dokumen ini dipakai **manual oleh pengurus** untuk memverifikasi bahwa perilaku aplikasi registrasi acara sesuai kebutuhan operasional sebelum rilis besar atau setelah perubahan penting.

**Referensi user story stakeholder:** [`user-stories-stakeholder.md`](../user-stories-stakeholder.md)  
**Referensi teknik QA/indeks jalur:** [`superpowers/plans/2026-05-04-user-stories-traceability.md`](../superpowers/plans/2026-05-04-user-stories-traceability.md)

## 1. Cara membaca panduan ini

- Setiap skenario punya ID `UAT-…` dipetakan ke `US-…` di dokumen stakeholder.
- Isi kolom pada **[`lembar-hasil-uat-ringkas.md`](./lembar-hasil-uat-ringkas.md)** setelah setiap skenario atau setiap sesi rapat UAT.
- **Lulus** = perilaku sama dengan ekspektasi. **Gagal** = tidak sama; catat pada lembar hasil dengan langkah reproducible. **Blok** = tidak bisa menjalankan (misalnya belum dapat akun atau data uji).

## 2. Konfigurasi lingkungan (isi sebelum hari pertama UAT)

| Item | Nilai yang dicantumkan tim pelaksana |
| --- | --- |
| BASE_URL aplikasi UAT/staging | _Contoh struktur_: `https://` + host yang diberikan tim IT (_bukan URL produksi kecuali disepakati_) |
| Akun penguji Owner atau Admin | email: … / metode akses (password atau magic link): … |
| Akun penguji Verifier (opsional) | email: … |
| Akun penguji Viewer (opsional) | email: … |
| Slug atau nama acara uji tetap | contoh nama internal: **UAT-Musim Dingin** (harus ada di sistem sebelum blok skenario registrasi publik, atau dibuat dalam Skenario EVT-01 dahulu) |
| Nomor anggota dummy yang boleh dipakai berulang | _hanya dipakai jika tim IT menyediakan anggota uji;_ jika tidak, gunakan nominal non-member sesuai form |

Aturan penyimpanan kata sandi: ikuti **kebijakan internal klub**; jangan menyalin kata sandi ke chat publik atau email tidak terenkripsi.

## 3. Artefak lokal penguji publik

- Satu berkas gambar **bukti transfer** palsu tetapi valid secara format (JPEG atau PNG di bawah 2 MB).
- Untuk skenario kartu anggota: satu foto atau gambar sampel kartu (**bukan data nyata sensitif**) jika acara mensyaratkan unggahan.

## 4. Definisi selesai (kriteria gabungan UAT)

UAT pengurus dinilai **selesai** bila semua hal berikut benar secara bersamaan:

1. Semua baris pada [`lembar-hasil-uat-ringkas.md`](./lembar-hasil-uat-ringkas.md) untuk skenario dengan prioritas **A** mencantumkan `Lulus` atau `Blok` yang disetujui penanggung jawab bisnis secara tertulis (`Blok` harus ada alasan di kolom Catatan).
2. Tiap `Gagal` mencatat **minimal**: ID skenario, langkah terakhir sebelum gagal, harapan vs aktual, waktu ISO lokal penguji (`2026-05-04 14:30 WIB`).
3. Penanggung jawab bisnis (misalnya Ketua Bidang atau Bendahara) menandatangani atau menyetujui email ringkasan eksekutor UAT.

## 5. Prioritas skenario

- **Prioritas A** — blokir go-live jika gagal pada lingkungan target: jalur registrasi publik lengkap sampai konfirmasi, masuk admin, inbox + persetujuan/tolakan minimal satu registrasi uji.
- **Prioritas B** — penting tetapi bisa dijadwalkan lanjutan: laporan/CSV, venue, kepengurusan, sebagian pengaturan klub tingkat pemilik.

---

## 6. Skenario UAT — Publik (prioritas utama A)

Gunakan mode **penyamaran / Incognito** pada browser agar tidak tercampur cookie admin.

### UAT-PUB-01 — Daftar acara terlihat sesuai jendela pendaftaran *(US-PUB-01)*

**Prasyarat:** BASE_URL bisa diakses tanpa masuk sebagai admin.

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Buka `BASE_URL` (homepage). | Tidak ada error server (“500”). |
| 2 | Catat apakah setiap kartu acara yang ditawarkan registrasi masih rasional (belum lewat secara bisnis atau diset tim IT sebagai “aktif uji”). | Daftar konsisten dengan penjelasan staging dari tim IT. |
| 3 | Jika ada acara tidak seharusnya tampil, catat nama acara tersebut di lembar hasil sebagai **Gagal** dengan menyebut nama. | Dokumentasi lengkap walau gagal lulus |

### UAT-PUB-02 — Detail acara *(US-PUB-02)*

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Klik salah satu acara prioritas **A**. | Halaman detail memuat nama, ringkasan biaya atau informasi harga yang terbaca, informasi tambahan tidak kosong secara semu. |

### UAT-PUB-03 sampai UAT-PUB-06 — Pengiriman formulir sampai konfirmasi *(US-PUB-03..06)* prioritas **A**

**Prasyarat:** Acara target mengizinkan satu alur baru; Anda mengetahui data yang boleh dipakai (nomor WA uji disarankan salah satu tim internal).

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Di halaman acara uji klik jalur registrasi sampai form utama muncul. | Form dapat diisi; tidak ada error Prisma/teknis pada layar pengguna akhir (kalau ada, gagal blok UAT dengan tangkapan layar). |
| 2 | Isi semua bidang wajib dengan data uji konsisten (“Nama Depan **UjiUAT2026**”). | Tidak bisa melanjutkan jika ada wajib kosong; pesan error bahasa Indonesia dapat dipahami. |
| 3 | Unggah bukti transfer sampel dari artefak lokal. Unggah kartu anggota **hanya** jika formulir mengharuskan — jika mengharuskan dan Anda tidak ada file, tulis **Blok** di lembar. | Unggahan diterima atau ditolak dengan pesan jelas sesuai aturan ukuran/format. |
| 4 | Kirim formulir (**Submit**). | Pengguna diarahkan ke halaman konfirmasi atau URL baru yang memuat minimal identitas/registrasi (bukan bilangan error). |
| 5 | Salin atau catat pengenal registrasi atau URL konfirmasi lembar hasil. | Ini dipakai skenario EVT berikut untuk persetujuan. |

Catatan bisnis **duplikasi kursi anggota** (US-PUB-03 kriteria kedua): hanya boleh diuji jika tim IT menyediakan skenario dua pendaftar dengan nomor member sama—jadikan skenario sekunder **prioritas B** dan minta panduan konkret mereka; jangan menebak.

---
