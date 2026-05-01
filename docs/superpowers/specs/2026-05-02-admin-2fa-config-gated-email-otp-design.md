# Desain: 2FA admin — TOTP, kode cadangan, dan OTP email ter-gate konfigurasi

**Tanggal:** 2026-05-02  
**Status:** disetujui konsep (persetujuan pemangku kepentingan untuk pendekatan §4 dan perilaku §5).

## 1. Konteks

Plugin **`twoFactor`** Better Auth sudah aktif di server (`issuer: "match-screening"`). Halaman **`/admin/settings/security`** berisi copy pembantu yang mengarahkan ke **`/admin/account`** dan dokumentasi Better Auth; **`twoFactorClient`** dan alur enrol/verifikasi penuh **belum** diimplementasi. Sign-in admin memakai `createAuthClient()` tanpa menangani **`twoFactorRedirect`**.

Kirim email transaksional untuk auth (magic link) saat ini masih *no-op* / `console.log` — sehingga **OTP email** hanya masuk akal setelah **konfigurasi pengiriman** siap. SMS tidak diminta pada fase ini.

## 2. Tujuan

| Kode | Tujuan |
|------|--------|
| **A** | **TOTP** (aplikasi authenticator) + **kode cadangan** + **verifikasi 2FA setelah sign-in** (kredensial) sesuai dokumentasi Better Auth. |
| **B** | **OTP email** (kode sekali pakai) sebagai metode verifikasi kedua **hanya bila** konfigurasi pengiriman valid; jika tidak, fitur ini **absen** dari API dan UI (bukan hanya error saat klik). |
| **C** | **Pengalaman terpusat** di **`/admin/account`** untuk mengelola 2FA; **`/admin/settings/security`** memperbarui copy agar konsisten (tanpa menduplikasi form enrol penuh). |
| **D** | Mempersiapkan **satu helper** pengirim email terpusat yang dapat dipakai ulang untuk OTP dan alur notifikasi/auth di masa depan. |

## 3. Bukan ruang lingkup (YAGNI)

- **SMS / WhatsApp OTP** pada rilis yang dibahas dokumen ini (dapat ditambah kemudian dengan penyedia terpisah).
- Toggle produk **Owner** di database untuk mengaktifkan OTP email (kecuali diputuskan lain pada tahap implementasi — default dokumen ini: **tanpa** saklar DB pada MVP).
- Mengubah persyaratan **magic link** atau mengirim magic link nyata (tetap bisa ditambah secara terpisah).
- **Trust device** lanjutan di luar default plugin kecuali ada kebutuhan eksplisit berikutnya.

## 4. Rekomendasi pendekatan

### 4.1 Gate OTP email (disarankan)

**Opsi plugin bersyarat:** Bangun objek konfigurasi `twoFactor(...)` sedemikian rupa sehingga **`otpOptions`** (termasuk **`sendOTP`**) **hanya disertakan** jika **`isEmailOtpConfigured()`** bernilai benar. Dengan demikian perilaku server Better Auth selaras dengan dukungan aktual; tidak ada endpoint OTP email “setengah hidup”.

### 4.2 Sinkron UI

Sumber kebenaran yang sama dipakai pada **Server Components** atau endpoint ringkas (mis. loader `/admin/account`): **`emailOtpAvailable`** (boolean). UI menampilkan aksi “Kirim kode ke email” **hanya jika** benar. Jika salah, tampilkan penjelasan singkat bahasa Indonesia bahwa verifikasi email sekunder belum diaktifkan oleh pengaturan lingkungan (tanpa menyebut nama variabel env pada pengguna akhir).

### 4.3 Alternatif yang ditolak untuk MVP

| Alternatif | Alasan penolakan |
|------------|------------------|
| **`sendOTP` selalu terpasang**, guard di dalam saja | Risiko ketidakselarasan endpoint/klien dengan dukungan nyata. |
| **Hanya UI yang disembunyikan** | Server tetap mengiklankan kemampuan OTP tanpa backend layak. |

## 5. Perilaku fungsional

### 5.1 Enrol dan pengelolaan (Akun)

- Dari **`/admin/account`**, pengguna dengan **email/password** dapat: mengaktifkan 2FA (aluran Better Auth: verifikasi password → setup TOTP → verifikasi pertama → penyimpanan secret), melihat/mencetak ulang **kode cadangan** sesuai API plugin, menonaktifkan 2FA dengan konfirmasi password.
- **OTP email** tidak dipakai untuk *enrol* TOTP; OTP email adalah **metode verifikasi saat login** bila dikonfigurasi (selaras dokumentasi Better Auth).

### 5.2 Sign-in dan redirect

- Setelah **`signIn.email`** (atau setara), jika respons menandai **langkah 2FA diperlukan**, klien mengarahkan ke **halaman verifikasi** (rute dedikasi, mis. `/admin/sign-in/two-factor` atau nama stabil lain) yang menangani: **TOTP**, **kode cadangan**, dan — jika **`emailOtpAvailable`** — permintaan **kirim OTP email** + input kode.
- **`twoFactorClient`** dipasang pada klien auth dengan **`onTwoFactorRedirect`** (atau pola dokumentasi terkini) mengarah ke halaman tersebut.

### 5.3 Konfigurasi “ada” untuk OTP email

- **`isEmailOtpConfigured()`** mengimplementasikan kebijakan eksplisit, misalnya (final pada implementasi): semua variabel wajib untuk penyedia terpilih terisi (contoh ilustratif: kunci API, alamat `from`, dan bila perlu domain terverifikasi).
- Jika konfigurasi tidak lengkap: **tidak** ada `otpOptions` pada plugin; halaman verifikasi tidak menampilkan jalur email.

### 5.4 Salinan halaman Keamanan

- **`/admin/settings/security`**: jelaskan bahwa **manajemen 2FA** dilakukan dari **Akun**; sebutkan bahwa **OTP email** bergantung pada konfigurasi pengiriman; pertahankan tautan dokumentasi Better Auth.

### 5.5 Komite & admin (transparansi)

- Tabel komite yang menampilkan **`twoFactorEnabled`** tetap konsisten dengan model Better Auth; tidak mengubah spesifikasi komite kecuali penyesuaian copy silang (*opsional*).

## 6. Keamanan dan pesan error

- Memanfaatkan **rate limiting** bawaan plugin untuk endpoint 2FA.
- Pesan untuk kegagalan kirim OTP email: **generik** (tidak membedakan secara kasar antara “mati konfigurasi” vs “gagal jaringan”) untuk pengguna akhir; detail untuk **log server** saja.
- Kode cadangan dan secret TOTP: mengikuti penyimpanan bawaan plugin (enkripsi sesuai konfigurasi Better Auth).

## 7. Pengujian

- **Unit:** `isEmailOtpConfigured()` untuk kombinasi env terisi/tidak.
- **Unit/integration:** pembentukan opsi plugin (dengan mock env) memverifikasi **`otpOptions` ada hanya jika** gate true.
- **Manual / smoke:** alur sign-in dengan 2FA aktif → halaman verifikasi; dengan gate false, tidak ada tombol email; dengan gate true, kirim dan verifikasi berhasil pada lingkungan staging.

## 8. Ketergantungan

- Better Auth: **`twoFactor`** (server), **`twoFactorClient`** (klien), migrasi CLI Better Auth bila kolom 2FA belum ada di basis data.
- Penyedia email transaksional (mis. Resend) — dipilih pada implementasi; harus kompatibel dengan **Vercel** / runtime server Next.js.
- Tidak mensyaratkan migrasi Prisma aplikasi tambahan kecuali Better Auth mengeluarkan migrasi baru untuk plugin.

## 9. Urutan rilis yang disarankan

1. **Inti:** `twoFactorClient`, halaman verifikasi, enrol TOTP + cadangan di **`/admin/account`**, penanganan **`twoFactorRedirect`**.
2. **Email OTP:** helper kirim email + gate + `otpOptions` bersyarat + UI bersyarat.

Urutan ini mencerminkan gabungan opsi perencanaan **“TOTP dulu”** dan **“email OTP ketika config siap”** tanpa menjual OTP email sebelum infrastruktur ada.
