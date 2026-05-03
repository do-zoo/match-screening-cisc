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

## Epik: Pengunjung dan pendaftar (publik)

### US-PUB-01 — Melihat acara yang sedang dibuka pendaftarannya

- **Sebagai** calon peserta, **saya ingin** melihat daftar acara yang relevan di beranda atau halaman daftar acara, **agar** saya tahu acara apa yang bisa saya ikuti sekarang.
- **Kriteria penerimaan:**
  - Acara yang sudah lewat jendela pendaftaran atau tidak aktif **tidak** ditampilkan sebagai pilihan registrasi utama.
  - Setiap kartu atau ringkasan acara menampilkan minimal nama acara dan indikasi apakah masih bisa mendaftar.

### US-PUB-02 — Membaca detail acara sebelum mendaftar

- **Sebagai** calon peserta, **saya ingin** membuka halaman detail acara dari tautan atau slug acara, **agar** saya memahami harga, waktu, kebijakan operasional terkait, dan persyaratan sebelum mengisi formulir.
- **Kriteria penerimaan:**
  - Halaman detail memuat ringkasan biaya dan informasi operasional yang konsisten dengan kebijakan klub untuk tampilan publik.

### US-PUB-03 — Mengisi formulir registrasi lengkap

- **Sebagai** pendaftar, **saya ingin** mengisi data diri, pilihan tiket, serta data pendamping jika diperbolehkan, **agar** pengajuan saya mencerminkan kebutuhan saya secara sah menurut aturan acara.
- **Kriteria penerimaan:**
  - Formulir memvalidasi field wajib; pesan kesalahan mudah dibaca dalam bahasa Indonesia.
  - Jika kursi member untuk nomor tertentu sudah terpakai oleh pendaftar lain pada acara yang sama, sistem menolak pengajuan dengan penjelasan yang jelas.

### US-PUB-04 — Melihat perkiraan total biaya saat mengisi formulir

- **Sebagai** pendaftar, **saya ingin** melihat rincian harga secara transparan **sebelum** submit, **agar** saya bisa mentransfer jumlah yang tepat.
- **Kriteria penerimaan:**
  - Total dan komponen harga (anggota/non-anggota, tambahan partner, item terkait menu bila ada) konsisten antara tampilan form dan nilai yang tersimpan setelah submit.

### US-PUB-05 — Mengunggah bukti pembayaran dan lampiran gambar yang diminta

- **Sebagai** pendaftar, **saya ingin** mengunggah bukti transfer (dan foto kartu anggota jika diminta), **agar** tim admin dapat memverifikasi identitas dan pembayaran saya.
- **Kriteria penerimaan:**
  - Unggahan ditolak jika tipe atau ukuran file tidak sesuai aturan form, dengan pesan yang jelas.
  - Setelah berhasil, bukti tersimpan dan terlihat oleh alur kerja admin pada registrasi tersebut.

### US-PUB-06 — Menerima konfirmasi setelah pengajuan terkirim

- **Sebagai** pendaftar, **saya ingin** diarahkan ke halaman konfirmasi berisi identitas pengajuan saya, **agar** saya punya bukti bahwa pendaftaran masuk ke sistem.
- **Kriteria penerimaan:**
  - URL konfirmasi unik per registrasi dan menampilkan status awal yang sesuai proses bisnis (misalnya menunggu tinjauan).

## Epik: Admin — masuk akun dan kontrol akses

### US-ADM-01 — Masuk dengan magic link atau email dan kata sandi

- **Sebagai** admin, **saya ingin** masuk ke konsol admin dengan metode yang disediakan (tautan ajaib atau email+kata sandi), **agar** saya dapat mengakses data acara dengan aman.
- **Kriteria penerimaan:**
  - Alur gagal login menampilkan pesan yang tidak membocorkan detail sensitif akun.
  - Setelah sukses, sesi admin terbentuk dan dashboard dapat diakses.

### US-ADM-02 — Verifikasi dua langkah bila kebijakan mengaktifkannya

- **Sebagai** admin, **saya ingin** menyelesaikan langkah kedua autentikasi setelah kredensial pertama, **agar** akun yang memerlukan 2FA memenuhi standar keamanan klub.
- **Kriteria penerimaan:**
  - Admin yang wajib 2FA tidak dapat melewati konsol tanpa menyelesaikan langkah tersebut.
  - Alur 2FA memberi petunjuk jelas bila kode salah atau kadaluarsa.

### US-ADM-03 — Pembatasan peran operasional

- **Sebagai** pemilik atau pengelola komite, **saya ingin** peran **Owner, Admin, Verifier, Viewer** memiliki batasan yang jelas, **agar** tugas verifikasi terpisah dari pengaturan tingkat klub yang sensitif.
- **Kriteria penerimaan:**
  - Verifier dapat menjalankan tugas tinjauan sesuai izin tanpa mengubah konfigurasi yang hanya untuk Owner/Admin tingkat lanjut.
  - Viewer tidak dapat mengubah data yang bersifat mutatif di luar ruang lingkup baca.
