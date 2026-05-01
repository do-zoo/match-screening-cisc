---
title: Pengaturan komite — modul lengkap dengan sub-path (Owner-only)
date: 2026-05-02
project: match-screening
status: ready-for-review
related:
  - 2026-05-02-admin-account-and-committee-settings-shell-design.md
  - 2026-05-02-admin-navigation-ia-v1-design.md
  - CLAUDE.md
---

## 1) Purpose

Mengunci desain fitur **Pengaturan** (`/admin/settings`) setelah MVP shell placeholder: navigasi **sub-path**, persistensi konfigurasi komite dan modul turunan (**branding**, **notifikasi**, **flags operasional**, **keamanan & audit**), serta integrasi dengan data dan pola akses yang sudah ada.

Dokumen ini **merevisi** bagian struktur **`/admin/settings`** pada **[spek shell akun & komite 2026-05-02](2026-05-02-admin-account-and-committee-settings-shell-design.md)**: daripada satu halaman banyak tab tanpa persistensi saja, **arah implementasi bertahap** adalah **hub** di `/admin/settings` ditambah **sub-rute** per area dengan Server Actions dan penyimpanan data sesuai fase §7.

Informasi navigasi sidebar global (**Pengaturan** hanya **Owner**) tetap mengikuti **[IA navigasi v1](2026-05-02-admin-navigation-ia-v1-design.md)** (`canManageCommitteeAdvancedSettings`).

## 2) Scope produk

### 2.1 In scope

1. **Sub-path** canonik di bawah `/admin/settings/*` untuk setiap modul (§4).
2. **Empat blok inti komite** (PIC & admin aplikasi; rekening bank & PIC; harga default global; template WhatsApp) dengan **persistensi** dan UX yang konsisten dengan domain Prisma/`guardOwner` (§5.1).
3. **Branding publik** — logo, teks footer, dan token tampilan minimal yang disepakati per fase (§5.2).
4. **Notifikasi & saluran** — konfigurasi preferensi dan saluran; pengiriman email **transaksional nyata** mengikuti ketersediaan provider & env (§5.3).
5. **Flags operasional** — toggle perilaku terdefinisi (mis. banner maintenance, penutupan pendaftaran global) dengan **nama flag stabil** dan dokumentasi satu baris per flag (§5.4).
6. **Keamanan & akses lanjutan** — kebijakan yang didukung Better Auth (mis. dorongan / kewajiban 2FA untuk Owner bila didukung konfigurasi); **audit log** append-only untuk perubahan konfigurasi sensitif dan subset aksi admin (§5.5).

### 2.2 Out of scope (kecuali direvisi eksplisit)

- Mengubah **Owner-only** untuk seluruh area `/admin/settings/*`.
- **i18n** multi-bahasa untuk UI publik/admin.
- Product analytics pihak ketiga.
- Layar **Akun pribadi** (`/admin/account`) — tetap terpisah.

### 2.3 Success criteria (tingkat produk)

- Owner dapat mengelola setiap modul yang **sudah diimplementasi pada fase berjalan** lewat URL yang dapat di-bookmark; non-Owner tidak melihat item menu dan mendapat `notFound()` / setara pada deep link.
- Default harga **global** untuk acara baru (`PricingSource.global_default`) dapat bersumber dari **DB** setelah modul siap; transisi dari env **`MATCH_DEFAULT_TICKET_*`** dokumentasi jelas (fallback dev atau migrasi sekali).
- Template pesan dapat disunting dengan **placeholder terdokumentasi** dan validasi; fallback ke implementasi TypeScript dapat digunakan selama migrasi aman (§6).
- Setiap **feature flag** yang diexpose di UI punya perilaku dokumentasi dan tes unit di mana aplikasi mencabang.

## 3) Locked architecture decisions

| Topik | Keputusan |
|--------|------------|
| Navigasi | **`/admin/settings`** = **hub** (daftar tautan ringkas/deskripsi ke sub-modul); **tidak** mengandalkan satu halaman panjang sebagai tujuan akhir untuk semua konten konfigurasi. |
| Sub-path | Satu segment per modul (§4); layout bersama boleh `src/app/admin/settings/layout.tsx`. |
| Akses | Semua loader dan Server Actions untuk modul-modul ini memakai **`guardOwner()`** dari `src/lib/actions/guard.ts` (atau pola setara **`canManageCommitteeAdvancedSettings`** + **`notFound()`** pada RSC), konsisten dengan komentar modul Owner-only pada `roles.ts`. |
| Data | **Hibrida**: entitas structural di tabel/normalized (anggota PIC, `PicBankAccount`, `AdminProfile`, template terstruktur, audit); singleton atau baris tunggel untuk defaults & branding gabungan boleh **asal** dapat di-upgrade tanpa menghapus sejarah kritikal audit. Hindari satu dokumen JSON opak untuk seluruh konfigurasi tanpa skema. |
| Error & copy | Server Actions mengembalikan **`ActionResult`**; pesan kesalahan Bahasa Indonesia. |

## 4) Sub-path canonik (IA)

Path internal memakai **Inggris kebab-case** selaras `next.config` dan rute admin yang ada.

| Modul | Path |
|--------|------|
| Hub | `/admin/settings` |
| PIC, admin aplikasi, penugasan terkait | `/admin/settings/committee` |
| Harga default global | `/admin/settings/pricing` |
| Template WhatsApp | `/admin/settings/whatsapp-templates` |
| Branding publik | `/admin/settings/branding` |
| Notifikasi & saluran | `/admin/settings/notifications` |
| Feature flags / operasional | `/admin/settings/operations` |
| Keamanan & audit | `/admin/settings/security` |

**Redirect legacy:** mempertahankan **`/admin/pengaturan` → `/admin/settings`** di `next.config.ts`; sub-path tidak wajib punya alias legacy kecuali diputuskan terpisah.

## 5) Modul — perilaku & batasan

### 5.1 Inti komite (PIC, bank, harga, WA)

- **PIC & rekening:** `MasterMember.canBePIC`, `PicBankAccount`, dan aturan `validatePicBankAndHelpers` di `admin-events` tetap sumber aturan domain. **Keputusan implementasi (wajib dipilih di rencana teknis, bukan di sini):** apakah **CRUD rekening** utama tinggal di alur **Anggota** dengan deep link dari `committee`, atau sebagian form disediakan di **Pengaturan** — **satu sumber kebenaran** untuk menghindari duplikat logic.
- **Admin aplikasi:** kelola `AdminProfile` / peran sesuai `bootstrap-admin` dan guard yang ada; mutasi hanya Owner.
- **Harga default:** menggantikan ketergantungan tunggal pada `getCommitteeTicketDefaults()` + env setelah modul aktif; perilaku baca tulis dokumentasikan di rencana implementasi (singleton `CommitteeTicketDefaults` atau nama setara).
- **Template WhatsApp:** penyimpanan isi per template dengan daftar placeholder; runtime merge dengan konteks registrasi (setara pemakaian `src/lib/wa-templates/messages.ts` hari ini).

### 5.2 Branding

- Unggah logo mengikuti pola upload Blob + sanitasi seperti cover acara (path deterministik, akses publik bila digunakan di situs umum — selaras kebijakan uploads di `CLAUDE.md`).
- Teks/metadata statis (footer, nama klub ringkas) disimpan pada baris singleton atau tabel khusus; invalidasi cache / revalidate tag didokumentasikan di implementasi.

### 5.3 Notifikasi & saluran

- **Fase awal:** model data preferensi (saluran mana yang diinginkan, template ID opsional).
- **Pengiriman nyata:** tergantung provider email (`sendMagicLink` saat ini **log konsol**); spec ini **mengizinkan** UI konfigurasi sebelum SMTP/API produksi ada, tetapi **tidak** mensyaratkan pengiriman sukses di produksi hingga provider terpasang. Rencana implementasi harus memisahkan “baca tulis konfigurasi” vs “deliver notification”.

### 5.4 Operations (feature flags)

- Representasi stabil: nama key string (ENUM di Prisma atau tabel key) + boolean/enum singkat + metadata deskripsi.
- Setiap flag memiliki dokumen perilaku satu kalimat dalam kode atau spek rencana; tidak menambah flag “misteri” tanpa cabang aplikasi.

### 5.5 Security & audit

- **2FA / kebijakan sesi:** hanya fitur yang didukung **Better Auth** dalam konfigurasi repo; tidak merancang skema auth paralel.
- **Audit log:** tabel append-only minimal dengan `actorAdminProfileId` (atau `authUserId` yang dipetakan), `action`, `targetType`, `targetId` opsional, `metadata` JSON terbatas, `createdAt`. Peristiwa minimum: perubahan peran admin, perubahan flags keamanan, perubahan flags operasional global, perubahan default harga, perubahan template WA (versi ringkas). Retensi dan volume ditinjau di implementasi (indeks berdasarkan waktu).

## 6) Migrasi & kompatibilitas

- **Harga:** setelah baris DB ada, urutan prioritas baca: DB → env → konstanta fallback (hanya satu urutan, dipatuhi di satu fungsi helper).
- **Template WA:** baca DB; jika baris kosong, fallback ke fungsi `messages.ts` untuk jenis pesan yang sama hingga Owner menyimpan versi DB.
- Tidak menghapus modul TypeScript template sebelum seluruh jenis pesan punya path DB atau disepakati sunsetting.

## 7) Phased delivery

| Fase | Isi |
|------|-----|
| **A** | Persist default harga; `committee` (PIC/admin/bank UX — keputusan sumber tunggal form); foundational guards + layout hub + skeleton sub-path lain bila perlu |
| **B** | Template WA + branding |
| **C** | Operations flags + banner/maintenance sesuai daftar flag |
| **D** | Notifikasi (hingga kirim nyata jika siap) + security policies + audit log |

Urutan boleh digeser sedikit atas kebutuhan operasi klub dokumentasikan satu baris dalam PR impl.

## 8) Testing

- Vitest untuk helper murni: substitusi placeholder template, pembacaan default harga dengan urutan fallback, derivation flag → perilaku aplikasi di titik yang terisolasi.
- Guard: regresi string `FORBIDDEN`/`NO_PROFILE` pada action sample (co-located test bila pola repo mendukung).
- Tidak memperkenalkan tes browser wajib jika konsisten dengan `CLAUDE.md` (Vitest node).

## 9) Risiko & mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Duplikasi form PIC/rekening | Pilih satu sumber utama + tautan dari modul lain (§5.1). |
| Scope audit + notifikasi membengkak | Batasi peristiwa audit v1 dan saluran notifikasi yang benar-benar diimplementasi per fase. |
| Branding + cache | revalidatePath/tag atau dokumentasi stale di implementasi. |

## 10) Relation to prior shell spec

**[2026-05-02-admin-account-and-committee-settings-shell-design.md](2026-05-02-admin-account-and-committee-settings-shell-design.md)** §5 menggambarkan **tab/section placeholder tanpa persistensi**. Implementasi fitur penuh **mengganti** arah tersebut dengan **sub-path + data** menurut dokumen ini; akun pribadi & tema di `/admin/account` tidak berubah karena dokumen ini.
