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

## Epik: Operasi acara, kotak masuk pendaftaran, dan pelaporan

### US-EVT-01 — Membuat dan mengedit acara

- **Sebagai** operator acara, **saya ingin** membuat acara baru dan mengubah pengaturannya (jadwal registrasi, harga, penanggung jawab keuangan, rekening tujuan, konfigurasi menu), **agar** pendaftar melihat informasi yang benar.
- **Kriteria penerimaan:**
  - Perubahan tersimpan dan tercermin di halaman publik sesuai aturan visibilitas.
  - Slug atau identitas acara stabil dan unik sehingga tidak bentrok dengan acara lain.

### US-EVT-02 — Melihat daftar pendaftaran per acara (kotak masuk)

- **Sebagai** admin, **saya ingin** melihat semua registrasi untuk satu acara dalam satu daftar, **agar** saya dapat memprioritaskan peninjauan.
- **Kriteria penerimaan:**
  - Daftar menampilkan status registrasi dan filter/urut yang memadai untuk operasional harian.

### US-EVT-03 — Membuka detail satu registrasi

- **Sebagai** verifier, **saya ingin** melihat profil pendaftar, bukti bayar, snapshot harga, dan riwayat keputusan, **agar** saya mengambil keputusan yang dapat dipertanggungjawabkan.
- **Kriteria penerimaan:**
  - Semua lampiran yang diunggah pendaftar dapat dibuka dari detail registrasi.

### US-EVT-04 — Menyetujui, menolak, atau menandai kendala pembayaran

- **Sebagai** verifier, **saya ingin** mengubah status registrasi ke disetujui, ditolak, atau menandai masalah pembayaran, **agar** komunikasi ke pendaftar selaras dengan keputusan klub.
- **Kriteria penerimaan:**
  - Perubahan status tercatat dan memicu template pesan yang relevan bila digunakan operasional (misalnya WhatsApp salin-tempel).
  - Tidak ada persetujuan ganda untuk kombinasi acara + nomor anggota yang melanggar aturan booking.

### US-EVT-05 — Mencatat kehadiran peserta

- **Sebagai** operator lapangan atau admin, **saya ingin** memperbarui status kehadiran setelah disetujui, **agar** laporan kehadiran akurat.
- **Kriteria penerimaan:**
  - Kehadiran tidak mengubah status persetujuan keuangan secara diam-diam; perubahan kehadiran terlihat di laporan.

### US-EVT-06 — Menu voucher — pencatatan penukaran

- **Sebagai** admin acara dengan mode voucher, **saya ingin** mencatat penukaran voucher peserta, **agar** stok/nilai voucher tercatat sesuai kebijakan acara.
- **Kriteria penerimaan:**
  - Penukaran mengikuti aturan event; duplikasi atau penyalahgunaan dicegah sesuai implementasi bisnis.

### US-EVT-07 — Penyesuaian invoice jika underpayment

- **Sebagai** admin keuangan, **saya ingin** mencatat penyesuaian tagihan dan bukti tambahan jika diperlukan, **agar** piutang tercatat dengan benar.
- **Kriteria penerimaan:**
  - Jumlah penyesuaian dan alasan dapat diaudit dari detail registrasi atau laporan terkait.

### US-EVT-08 — Pembatalan dan refund

- **Sebagai** admin, **saya ingin** menandai pembatalan atau refund sesuai kebijakan, **agar** status akhir registrasi jelas bagi pelaporan.
- **Kriteria penerimaan:**
  - Status terminal (batal/refund) tidak dapat ditindaklanjuti seperti registrasi aktif biasa tanpa alur koreksi khusus.

### US-EVT-09 — Validasi data anggota pada registrasi

- **Sebagai** verifier, **saya ingin** menandai validasi terhadap data keanggotaan ketika diperlukan, **agar** keputusan persetujuan konsisten dengan direktori.
- **Kriteria penerimaan:**
  - Tindakan validasi terlihat di riwayat registrasi dan mendukung alur persetujuan.

### US-EVT-10 — Laporan agregat dan ekspor CSV

- **Sebagai** ketua acara atau bendahara, **saya ingin** melihat ringkasan kehadiran, keuangan, agregasi menu/voucher, dan mengekspor CSV, **agar** rapat penutupan acara berjalan lancar.
- **Kriteria penerimaan:**
  - CSV mengikuti format standar yang dibagikan stakeholder (misalnya kolom tetap) dan dapat dibuka di spreadsheet umum.
  - Angka di layar laporan selaras dengan detail registrasi untuk sampel acak yang diuji manual.

## Epik: Direktori anggota (master)

### US-DIR-01 — Mengelola direktori dan impor/ekspor CSV

- **Sebagai** pengurus data anggota, **saya ingin** menambah, mengubah, dan mengimpor/mengekspor anggota dalam skala massal, **agar** validasi registrasi mengacu pada data terkini.
- **Kriteria penerimaan:**
  - Impor CSV menolak baris yang tidak valid dengan pesan yang dapat ditindaklanjuti.
  - Ekspor mencerminkan isi basis data pada saat permintaan (dengan toleransi cache tampilan jika ada di UI).

## Epik: Kepengurusan dan periode dewan

### US-MGT-01 — Mengatur periode kepengurusan dan penugasan jabatan

- **Sebagai** sekretaris atau admin struktural, **saya ingin** mendefinisikan periode dewan dan siapa menjabat apa, **agar** aturan kelayakan terkait pengurus di direktori tetap akurat.
- **Kriteria penerimaan:**
  - Perubahan struktur memperbarui indikator terkait di direktori sesuai aturan bisnis klub (misalnya status pengurus untuk periode aktif).

## Epik: Venue

### US-VEN-01 — Mengelola venue dan subset menu terkait acara

- **Sebagai** operator fasilitas, **saya ingin** mengelola daftar venue dan paket menu yang dapat dipakai acara, **agar** editor acara hanya menawarkan pilihan yang sah.
- **Kriteria penerimaan:**
  - Acara tidak dapat mereferensikan item menu di luar subset yang diperbolehkan untuk venue yang dipilih (sesuai aturan integritas data).

## Epik: Pengaturan klub dan komunikasi

### US-SET-01 — Branding dan identitas tampilan

- **Sebagai** pemilik, **saya ingin** mengatur elemen branding yang ditampilkan pengguna, **agar** tampilan publik konsisten dengan identitas klub.

### US-SET-02 — Template pesan WhatsApp

- **Sebagai** admin komunikasi, **saya ingin** mengelola template pesan untuk skenario persetujuan, penolakan, kendala bayar, pembatalan, refund, dan penagihan kekurangan, **agar** tim lapangan menyalin pesan yang konsisten.

### US-SET-03 — Preferensi notifikasi

- **Sebagai** admin, **saya ingin** mengatur preferensi notifikasi keluar, **agar** channel komunikasi selaras dengan kebijakan privasi dan operasional.

### US-SET-04 — Harga khusus komite dan pengaturan operasional

- **Sebagai** pemilik, **saya ingin** mengatur parameter harga komite dan kebijakan operasional klub, **agar** perhitungan di form publik dan keputusan admin tidak bertentangan dengan kebijakan tertulis.

### US-SET-05 — Keamanan akun dan profil admin

- **Sebagai** admin, **saya ingin** memperbarui informasi profil dan preferensi keamanan yang disediakan UI, **agar** akun pengelola tetap aman dan terkini.
