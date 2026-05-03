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
