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

## 7. Skenario UAT — Admin masuk dan peran (prioritas A untuk ADM-01; B untuk pembatasan rinci)

Lakukan di jendela browser **biasa** (bukan penyamaran) setelah keluar dari sesi penyamaran publik atau gunakan browser lain.

### UAT-ADM-01 — Login berhasil *(US-ADM-01)* **A**

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Buka `BASE_URL/admin/sign-in` (atau path masuk yang diberikan operator). | Form login terlihat. |
| 2 | Masuk dengan kredensial admin UAT Owner/Admin sesuai tabel §2 (password atau tautan dari email). | Setelah langkah otentikasi, dashboard admin utama atau redirect ke halaman pertama admin muncul. |
| 3 | Sengaja gagal kata sandi pada akun tes sekali (**jangan sampai terkunci**). | Pesannya tidak menyebut “user tidak ada” vs “password salah” secara bocor secara berlebihan seperti produk buruk klasik (_terima perilaku konkret aplikasi Anda_; catat jika sensitivitas tidak memadai sebagai temuan.). |

### UAT-ADM-02 — 2FA aktif ketika ada *(US-ADM-02)* **B**

Hanya jalankan jika tim IT menyatakan 2FA wajib pada akun uji Anda.

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Setelah kata sandi, ikuti arahan **verifikasi kedua**. | Tidak bisa melewati tanpa OTP/TOTP sah; gagal OTP memberi kesempatan mencoba ulang. |

### UAT-ADM-03 — Verifier tidak mengubah setting klub *(US-ADM-03)* **B**

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Login sebagai Verifier pada akun terpisah. | Dapat membuka kotak masuk event yang Anda punya akses. |
| 2 | Coba akses submenu pengaturan klub sensitif tingkat Pemilik seperti **Pengaturan komite lanjutan** (_nama menu persis bisa berbeda_). | Jika tidak bisa mengubah / tidak bisa mengakses, catat sebagai lulus pembatasan. Jika bisa mengubah parameter yang seharusnya terlarang untuk Verifier → **Gagal** dokumentasikan apa yang berhasil diubah. |

Viewer: tes singkat sama—**Viewer** boleh melihat tetapi tidak mengubah aksi kritikal sama seperti di atas (**B**).

## 8. Skenario UAT — Operasi acara, inbox, aksi reviewer, laporan

### UAT-EVT-01 — Membuat/edit acara pendek *(US-EVT-01)* **B**

Hanya bagi pengguna dengan peran bisa mengedit event. Minimum: buka editor acara tunjukkan perubahan judul internal disimpan.

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Dari admin, buka daftar acara → pilih acara uji → **Edit** (_atau buat acara baru jika kebijakan UAT memungkinkan_). | Form editor memuat field harga, jadwal, menu. |
| 2 | Ubah satu field teks non-kritis (misalnya catatan internal / deskripsi singkat) → **Simpan**. | Notifikasi sukses atau tidak ada error; reload halaman memuat nilai baru. |

### UAT-EVT-02 & 03 — Inbox dan detail registrasi dari UAT-PUB *(US-EVT-02, US-EVT-03)* **A**

**Prasyarat:** Registrasi dari UAT-PUB-06 tercipta dengan ID/URL dikenal.

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Buka inbox acara tersebut. | Registrasi uji (**Nama Depan UjiUAT2026**) muncul. |
| 2 | Buka detail registrasi tersebut. | Terlihat unggahan bukti pembayaran; dapat dibuka (preview/tab baru). Snapshot harga terlihat. |

### UAT-EVT-04 — Ubah status ke menyetujui *(US-EVT-04)* **A**

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Di detail registrasi uji pilih aksi **Setujui** (_label persis mengikuti UI Indonesia saat ini_). | Status berubah menjadi disetujui; tidak ada error teknis. |

### UAT-EVT-04b — Tolak satu registrasi khusus uji kedua (**B**) — jalankan **hanya** jika Anda dapat membuat pendaftar uji kedua

Alur paralel sama seperti PUB kemudian **Tolak**. Ekspektasi: status **ditolak** jelas pada daftar dan detail.

### UAT-EVT-05 — Kehadiran *(US-EVT-05)* **B**

**Prasyarat:** Registrasi uji telah disetujui.

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Ubah status kehadiran menurut pilihan UI (misal hadir/tidak hadir/alasan). | Tersimpan tanpa menghapus status keuangan; cek lagi setelah reload. |

### UAT-EVT-06 sampai US-EVT-09 — Voucher / invoice tambahan / batal / refund / validasi anggota **B**

Jalankan **hanya** bila acara uji mendukung mode tersebut; jika tidak, tulis `Blok` dengan alasan “Event uji tidak mode voucher / tidak ada underpayment / tidak menjalankan batal”.

Contoh **UAT-EVT-10** **A** (laporan ringkas):

| Langkah | Aksi penguji | Ekspektasi |
| --- | --- | --- |
| 1 | Buka halaman laporan acara tempat registrasi uji berada. | Angka ringkasan kasar selaras: minimal **1** registrasi disetujui jika Anda menyetujui satu. |
| 2 | Unduh ekspor CSV jika tersedia. | File terbuka di Excel/Numbers; baris contoh berisi **UjiUAT2026** atau ID registrasi uji. |

---
