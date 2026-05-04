# Admin invite & onboarding (Owner-provisioned credentials)

**Status:** Desain disetujui untuk opsi 1 (tabel undangan + halaman terima + `signUpEmail` server-side).  
**Tanggal:** 2026-05-04  

## 1. Latar belakang

Alur **Komite & admin** saat ini meminta email yang **sudah** punya baris `User` Better Auth. Praktik penyediaan akun sering jatuh ke CLI (`pnpm bootstrap:admin`), sehingga jurang antara “mengundang orang” dan “ada user di DB” membingungkan.

**Tujuan bisnis:** Owner mengundang admin dengan **email + peran**; penerima menyelesaikan **onboarding** (kredensial dan data minimal) lewat **taut satu kali**, tanpa membuka pendaftaran bebas.

## 2. Ruang lingkup

### Dalam cakupan

- Model **`AdminInvitation`** + migrasi Prisma.
- Aksi Owner: **buat undangan** (email + peran), **batalkan** undangan belum terpakai, **lihat** undangan tertunda/kedaluwarsa.
- Pengiriman email undangan memakai **`sendTransactionalEmail`** bila terkonfigurasi; jika tidak — **tampilkan URL lengkap sekali** di UI (analog magic link dev).
- Halaman **terima undangan** (token di path atau query — dipilih implementasi; token tidak boleh login public).
- Server: setelah validasi token, **`auth.api.signUpEmail`** (pola yang sama dengan `scripts/bootstrap-admin.ts`) untuk membuat **`User` + credential**, lalu **`AdminProfile.create`** dengan peran dari undangan, lalu undangan ditandai **`consumedAt`**.
- **`ClubAuditLog`** untuk membuat, membatalkan, dan mengonsumsi undangan (aksi string baru, konsisten dengan repo).
- Pembatasan mutasi: **`guardOwner()`** (sama seperti mutasi komite lain).

### Luar cakupan (fase ini)

- Mengundang langsung dengan peran **`Owner`** (lihat §4.2).
- Mengubah **`disableSignUp`** pada plugin magic link menjadi pendaftaran publik.
- Onboarding panjang (foto, verifikasi WhatsApp, dll.) kecuali satu field teks tambahan yang eksplisit diminta PO nanti.
- **2FA wajib** pada langkah pertama undangan (tetap bisa mengikuti kebijakan setelah masuk).

### Kepatuhan dengan kode yang ada

- **Tetap** sediakan jalur **`addCommitteeAdminByEmail`** untuk email yang **sudah** punya `User` tetapi belum punya `AdminProfile` (mudah diarahkan dari pesan error pembuatan undangan). Rencana deprecate UI terpisah bisa mengikuti setelah undangan stabil.

## 3. Alur pengguna

### 3.1 Owner

1. Buka **Pengaturan → Komite & admin**.
2. **Undang admin:** isi **email** + **peran** (dibatasi enum; lihat §4.2).
3. Sistem menormalisasi email, menolak benturan (lihat §7), membuat baris undangan, mencatat audit.
4. Jika email transaksional aktif — kirim templat “Undangan admin”. Jika tidak — tampilkan **taut penyalinan** + peringatan rahasia.

### 3.2 Penerima undangan

1. Buka URL undangan (kedaluwarsa + sekali pakai — §6).
2. Isi form **onboarding minimal:** **nama tampilan** (map ke `User.name`) + **kata sandi** (kebijakan panjang mengikuti Better Auth / pola bootstrap).
3. Submit → server memvalidasi token → `signUpEmail` → `AdminProfile` → konsumsi undangan → redirect ke **`/admin/sign-in`** (atau halaman sukses dengan CTA masuk — diputus implementasi tetap konsisten satu pilihan).
4. Pesan gagal dalam **Bahasa Indonesia** (reuse pola `ActionResult` / `rootError`).

## 4. Model data

### 4.1 `AdminInvitation` (usulan kolom)

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | cuid | PK |
| `emailNormalized` | String | lowercase trim; uniqueness untuk **aktif** diatur di §4.3 |
| `role` | `AdminRole` | Nilai dari undangan |
| `tokenHash` | String | Hash token acak — **jelas rahasia tidak disimpan plaintext** |
| `expiresAt` | DateTime | TTL default proposal: **168 jam** (7 hari); boleh konstanta kode |
| `createdAt` | DateTime | |
| `createdByAdminProfileId` | String | FK → `AdminProfile`, `onDelete: Restrict` |
| `consumedAt` | DateTime? | non-null ⇒ sudah onboarding |
| `revokedAt` | DateTime? | non-null ⇒ dibatalkan Owner |

 indeks disarankan: `(emailNormalized, consumedAt, revokedAt)` sesuai query “ada undangan aktif?”; `(expiresAt)` untuk pembersihan opsional.

### 4.2 Peran yang boleh diundang

**Hanya** `Admin`, `Verifier`, `Viewer`.  
**Tidak** `Owner` lewat undangan pada fase ini; menambah Owner tetap lewat **Owner yang ada** (ubah peran di tabel komite, dengan invariant minimal satu Owner yang sudah ada) atau **bootstrap CLI**.

### 4.3 Aturan aktif

Paling banyak **satu undangan “aktif”** per `emailNormalized`: aktif = `consumedAt` null **dan** `revokedAt` null **dan** `expiresAt` > now.  
Membuat undangan baru untuk email yang masih punya undangan aktif → **gagal** dengan pesan sarankan batalkan dulu **atau** otomatis **revoke** undangan lama — pilih **satu** di implementasi; dokumen ini merekomendasikan **gagal eksplisit** agar Owner sadar.

## 5. Antarmuka & rute

- **Rute publik terbatas token:** mis. `/(auth)/admin/invite/[token]/page.tsx` atau `invite/accept` + query — hindari indexer bot dengan `noindex` metadata jika perlu.
- **Form:** RHF + zod serupa modul lain; tidak mengirim token ke analytics.
- Halaman Komite:** daftar admin tetap + **bagian Undangan tertunda** (tanggal kedaluwarsa, siapa pembuat, aksi Batalkan).

## 6. Keamanan

- Token: **`crypto`** CSPRNG panjang mencukupi (mis. ≥ 32 byte), encode URL-safe; simpan **`tokenHash`** (mis. SHA-256 hex dari token — atau pola hash satu arah lain yang konsisten dengan repo).
- Validasi sekali pakai: setelah sukses, `consumedAt` diset dalam transaksi dengan pembuatan profil.
- **Rate limiting** pragmatic pada route handler Server Action submit (minimal delay / cap per IP dapat ditunda ke hardening lanjutan jika belum ada util — catat sebagai follow-up kalau tidak selesai fase pertama).
- Isi onboarding **tidak** mengeksekusi markdown/HTML berbahaya pada nama.

## 7. Kebijakan benturan email

Saat Owner **membuat undangan**:

- Jika sudah ada **`AdminProfile`** untuk `authUserId` dari `User` dengan email sama → tolak (**sudah admin**).
- Jika ada **`User`** dengan email sama tetapi **belum** `AdminProfile` → tolak undangan baru dengan pesan: gunakan **Tautkan admin (email ada)** — jalur `addCommitteeAdminByEmail`.

Saat **menerima undangan**:

- Jika **`User`** email sudah ada (race) → gagal sopan dengan arahan hubungi Owner; jangan menyisakan undangan terbuka konsumsi ganda — transaksi gagal rollback konsumsi.

## 8. Audit

Tambahkan konstanta baru di `club-audit-actions.ts`, mis.:

- `admin_invitation.created`
- `admin_invitation.revoked`
- `admin_invitation.consumed` (metadata: email, role)

`actorAdminProfileId` mengikuti pembuat atau null untuk konsumen jika sistem — preferensi: **buat undangan** = Owner; **consumed** = bisa `null` aktor profile atau tidak set untuk user baru; dokumentasikan satu pilihan di implementasi agar konsisten.

## 9. Pengujian

- Unit: normalisasi email, aturan “satu aktif”, hash verify.
- Unit/integrasi: server action Owner — forbidden non-owner.
- Integrasi atau tes ringan: onboarding happy path dengan mock pada `auth.api` jika praktik repo mendukung; jika tidak, smoke manual dokumentasikan di rencana implementasi.

## 10. Rilis & dokumentasi opsional

- Perbarui `CLAUDE.md` satu kalimat mengenai undangan vs tautan email-only.
- Stakeholder: satu bullet di **`docs/user-stories-stakeholder.md`** epik SET/ADM boleh ditambahkan terpisah (di luar obligasi komit desain ini).

## 11. Self-review checklist (penulis spesifikasi)

- **Placeholder:** tidak ada TODO/TBD bebas.
- **Konsisten:** jalur bootstrap CLI tetap ada; undangan tidak menggantikan migrasi Better Auth.
- **Ambiguitas:** redirect pasca-sukses = **`/admin/sign-in`** (default dokumentasi ini); konsumsi transaksi gagal menyebabkan undangan tidak ter-flag consumed.
- **Skop:** satu epik dapat satu rencana implementasi; pecah menjadi PR bertahap (schema → server actions Owner → halaman invite → UI komite).

---

Setelah dokumen ini disetujui di review manusia, langkah lanjutan: **`writing-plans`** untuk menguraikan tugas berkas-demikian.
