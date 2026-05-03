# User Story Aplikasi Registrasi Acara CISC (untuk Stakeholder)

Dokumen ini menjelaskan **apa yang bisa dilakukan pengguna** melalui aplikasi, dalam bahasa sehari-hari. Untuk pemetaan ke pengujian otomatis dan jalur kode, lihat [dokumen traceability QA](./superpowers/plans/2026-05-04-user-stories-traceability.md).

## Siapa pembaca dokumen ini

- Pengurus klub dan komite acara yang ingin memahami **ruang lingkup fungsi** sebelum rapat atau perencanaan musim.
- Operator administrasi yang **bukan** engineer, sebagai bahan onboarding singkat.
- Product owner / sponsor yang perlu **daftar kebutuhan tingkat tinggi** tanpa detail implementasi.

## Format user story

Setiap story memakai pola:

- **Sebagai** *peran*, **saya ingin** *aksi atau informasi*, **agar** *manfaat bisnis*.
- **Kriteria penerimaan:** bullet yang bisa diverifikasi secara operasional (manual atau melalui laporan), **tanpa** menyebut nama teknis framework.

## Ringkasan produk (satu paragraf)

Aplikasi ini mendukung **pendaftaran acara** untuk anggota dan non-anggota: pengunjung publik melihat acara aktif, mengisi formulir, mengunggah bukti pembayaran, lalu menerima konfirmasi. **Tim admin** masuk dengan akun aman, mengelola data acara, meninjau setiap pendaftaran, memutuskan persetujuan atau penolakan, mencatat kehadiran, menangani voucher/menu, penyesuaian pembayaran, serta membatalkan atau mengembalikan dana bila kebijakan mengizinkan. **Pengurus** juga mengelola direktori anggota, venue, struktur kepengurusan, dan pengaturan klub (branding, pesan WhatsApp, notifikasi, harga komite, kebijakan operasional).

## Glosarium singkat

| Istilah | Arti untuk stakeholder |
| --- | --- |
| Acara (event) | Kegiatan klub yang dibuka pendaftarannya; punya harga, jadwal registrasi, dan konfigurasi menu. |
| Registrasi | Satu pengajuan peserta untuk satu acara; punya status alur persetujuan. |
| Tiket utama / partner | Peserta utama (biasanya anggota) dan peserta pendamping jika aturan acara mengizinkan kursi partner. |
| Bukti transfer | Unggahan bukti pembayaran yang dilampirkan pendaftar. |
| Status registrasi | Alur umum: **terkirim** → **menunggu tinjauan** → **disetujui**, **ditolak**, atau **kendala pembayaran**. Setelah disetujui, kehadiran dan invoice penyesuaian dikelola di jalur lain. Akhir periode bisa **dibatalkan** atau **refund** (terminal). |
| Mode menu | Cara acara menangani pilihan makan/minum: pilihan di muka (**prapilih**) atau **voucher** yang dicatat saat acara. |
| Direktori anggota | Basis data anggota klub yang dipakai untuk validasi nomor anggota dan kelayakan tertentu. |
| Peran admin | **Pemilik (Owner)** dan **Admin** mengoperasikan hampir semua modul; **Verifier** fokus meninjau pendaftaran; **Viewer** hanya melihat sesuai izin. |
| Kepengurusan | Struktur periode dewan/jabatan yang mempengaruhi flag tertentu di direktori (misalnya kelayakan partner untuk periode aktif). |
