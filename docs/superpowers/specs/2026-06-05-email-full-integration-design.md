---
title: Integrasi email penuh — template, action, paritas WA
date: 2026-06-05
project: match-screening
status: approved
supersedes-partially:
  - docs/superpowers/specs/2026-06-06-email-templates-and-blast-design.md (scope v1)
  - docs/superpowers/specs/2026-06-05-event-verification-comms-design.md (non-goal receipt email)
---

# Integrasi email penuh — template, action, paritas WA

## Problem

1. **Empat** `EmailTemplateKey` di DB, tetapi **`invoice` tidak pernah dikirim** — hanya bisa diedit di admin.
2. **Tujuh** momen komunikasi registrasi punya template **WA** (`ClubWaTemplate`), tetapi hanya **dua** punya email (`registration_approved`, `invoice_underpayment`).
3. Dialog pasca-aksi ([`RegistrationNotifyDialog`](../../../src/components/admin/registration-notify-dialog.tsx)) hanya **WhatsApp**; email tagihan kekurangan sudah ada di Operasi tetapi tidak terintegrasi visual dengan WA reminder.
4. **OTP 2FA** dan **undangan admin** masih hardcoded React Email — tidak konsisten dengan editor blok Owner di `/admin/settings/templates/email`.
5. Perubahan lokal (line items, summary card, preview vars) belum menutup loop untuk semua template.

## Goal

Satu peta jelas: **setiap email transaksional** yang produk kirim (atau tawarkan) punya:

- Entri di `EMAIL_TEMPLATE_CATALOG` + baris `ClubEmailTemplate` (bila dapat diedit Owner)
- Fungsi render (`render*Email` / `renderEmailFromBlocks`)
- Fungsi kirim (`send*EmailForRegistration` atau setara auth)
- Trigger (otomatis dan/atau manual) yang selaras dengan action server & UX admin
- Logging `EmailDeliveryLog` dengan `templateKey` yang benar

Paritas dengan WA: **isi pesan** mengikuti default WA yang sudah ada; **saluran** tetap terpisah (email Resend vs `wa.me` manual).

## Non-goal

- WhatsApp Business API / pengiriman WA otomatis.
- Template email untuk hal di luar alur registrasi/admin auth (mis. newsletter).
- Terjemahan multi-bahasa.

---

## Keputusan produk

| Topik | Keputusan |
| ----- | --------- |
| Enum `EmailTemplateKey` | Perluas ke **11** nilai (lihat tabel di bawah) |
| Naming | Selaras WA di mana memungkinkan (`receipt`, `rejected`, …); `registration_approved` tetap (sudah di produksi) |
| OTP / undangan | **Masuk** `ClubEmailTemplate`; auth memuat DB + fallback default |
| Receipt setelah submit | **Opsional otomatis** — default **mati**; nyala lewat preferensi komite |
| Keputusan verifikasi (reject / payment issue) | **Manual email** di dialog terpadu; opsional auto via preferensi (default mati) |
| Approve | Tetap **auto** kirim `registration_approved` bila `contactEmail` (perilaku sekarang) |
| Tagihan pendaftaran (`invoice`) | Tombol manual + **blast** terpisah dari underpayment |
| Tagihan kekurangan | Tombol manual + blast existing (`invoice_underpayment`) |
| Dialog pasca-aksi | **Satu dialog** WA + email: pratinjau keduanya, **Buka WhatsApp**, **Kirim email**, **Lewati** |
| Mode saluran | `ClubNotificationPreferences.outboundMode` tetap mengontrol apakah Resend benar-benan dipanggil |
| Akses edit template | Owner (`canManageCommitteeAdvancedSettings`) |
| Akses kirim registrasi | `guardEvent` + `canVerifyEvent` |

### Peta template ↔ WA ↔ action

| `EmailTemplateKey` | Padanan WA | Trigger otomatis (default) | Trigger manual |
| ------------------ | ---------- | --------------------------- | -------------- |
| `receipt` | `receipt` | Submit publik **jika** pref `emailAutoOnSubmitReceipt` | — |
| `invoice` | — (tagihan awal) | — | Detail registrasi; blast tagihan pendaftaran |
| `invoice_underpayment` | `underpayment_invoice` | — | Operasi (tombol + blast) |
| `registration_approved` | `approved` | `approveRegistration` | Tab verifikasi / ringkasan — kirim ulang |
| `rejected` | `rejected` | Pref `emailAutoOnReject` (default off) | Dialog pasca-`rejectRegistration`; kirim ulang |
| `payment_issue` | `payment_issue` | Pref `emailAutoOnPaymentIssue` (off) | Dialog pasca-`markPaymentIssue`; kirim ulang |
| `cancelled` | `cancelled` | Pref `emailAutoOnCancel` (off) | Dialog pasca-`cancelRegistration`; kirim ulang |
| `refunded` | `refunded` | Pref `emailAutoOnRefund` (off) | Dialog pasca-`refundRegistration`; kirim ulang |
| `magic_link` | — | Better Auth `sendMagicLink` | — |
| `admin_invite` | — | `createAdminInvitation` | — |
| `otp` | — | Better Auth `sendOTP` (2FA) | — |

---

## Schema (Prisma)

### `EmailTemplateKey` (migration berurutan)

Tambahkan nilai enum (satu migration atau beberapa `ADD VALUE`):

```
receipt
rejected
payment_issue
cancelled
refunded
admin_invite
otp
```

(`invoice`, `invoice_underpayment`, `registration_approved`, `magic_link` sudah ada.)

### `ClubNotificationPreferences`

Tambah kolom boolean (default **false** kecuali disebut):

| Kolom | Default | Arti |
| ----- | ------- | ---- |
| `emailAutoOnSubmitReceipt` | `false` | Kirim `receipt` setelah `submitRegistration` sukses |
| `emailAutoOnApprove` | `true` | Pertahankan auto bukti pembayaran (setara perilaku sekarang) |
| `emailAutoOnReject` | `false` | Auto email setelah tolak |
| `emailAutoOnPaymentIssue` | `false` | Auto email setelah payment issue |
| `emailAutoOnCancel` | `false` | Auto setelah cancel |
| `emailAutoOnRefund` | `false` | Auto setelah refund |

UI: sub-bagian di **Pengaturan → Notifikasi** (Owner), penjelasan Bahasa Indonesia.

### `EmailDeliveryLog`

Tidak berubah — setiap kirim (sukses/gagal) tetap append dengan `templateKey` yang sesuai.

---

## Arsitektur kode

### Lapisan

```
Action (verify-registration, cancel-refund, submit-registration, auth, invitations)
  → send* / trySend* helpers (eligibility, outboundMode, Resend)
    → render*Email (vars dari registrasi / auth context)
      → renderEmailFromBlocks + club-email-blocks
```

### Modul baru / diperluas

| Modul | Tanggung jawab |
| ----- | -------------- |
| `lib/email/send-registration-lifecycle-email.ts` | Helper generik: load template, render, kirim, log — dipanggil per key |
| `lib/email/send-registration-invoice-email.ts` | `invoice` — eligibility tanpa unpaid underpayment |
| `lib/email/registration-invoice-blast.ts` | Preview + blast `invoice` (mirror underpayment) |
| `lib/email/send-receipt-email.ts` | `receipt` — dipanggil dari `submitRegistration` |
| `lib/email-templates/render-*-email.ts` | Satu file per kelompok atau per key untuk lifecycle |
| `lib/email-templates/email-template-catalog.ts` | Semua 11 entri + `triggerDescriptionId` |
| `lib/email-templates/build-email-template-index-rows.ts` | Kolom "Dipakai saat" di indeks |
| `lib/actions/admin-*-email.ts` | Server actions kirim manual + blast |
| `lib/auth/render-auth-emails.ts` | Ganti `render-emails.ts` — OTP & invite dari blok DB |

### Token & blok

- **Lifecycle dengan alasan:** wajib `{reason}` di `rejected` / `payment_issue` (validasi editor = WA).
- **Receipt:** `contact_name`, `event_title`, `registration_id`, `computed_total_idr`; blok opsional `registration_receipt` ringkas atau paragraf saja.
- **Cancelled / refunded:** paragraf + disclaimer; token sama dengan WA.
- **Admin invite:** `cta_button` + `{invite_url}`, `{role_label}`.
- **OTP:** paragraf `{otp_code}` + disclaimer keamanan; **jangan** log OTP di `EmailDeliveryLog.metadata`.
- **Invoice / underpayment:** pertahankan `invoice_summary`, `bank_details`, `transaction_line_items_json` (WIP yang ada).

### Eligibility bersama

Fungsi `canSendRegistrationEmail(registration, key)`:

- `contactEmail` terisi (normalize)
- Status registrasi sesuai key (mis. `approved` hanya untuk `registration_approved`)
- `invoice` vs `invoice_underpayment`: mutual exclusive — jika ada underpayment unpaid, hanya underpayment
- Exclude terminal yang tidak relevan (mis. jangan kirim `receipt` setelah `rejected`)

---

## UX admin

### 1. Indeks template email

- Kolom **Dipakai saat** dari `triggerDescriptionId` katalog.
- Badge **Sistem** untuk `magic_link`, `otp`, `admin_invite` (tetap editable Owner, tetapi tidak dari alur registrasi).

### 2. Dialog komunikasi terpadu

Ganti / perluas `RegistrationNotifyDialog` → **`RegistrationCommsDialog`**:

- Judul sesuai `RegistrationNotifyKind` + padanan email
- Dua pratinjau: WA (existing) + ringkasan email (subject + cuplikan teks)
- **Buka WhatsApp** — unchanged
- **Kirim email** — panggil server action; toast sukses/gagal; disabled bila tidak ada `contactEmail` atau outbound off (tetap boleh dry-run log)
- **Lewati**

Mapping kind → email key:

| `RegistrationNotifyKind` | Email key |
| ------------------------ | --------- |
| `approved` | `registration_approved` |
| `rejected` | `rejected` |
| `payment_issue` | `payment_issue` |
| `cancelled` | `cancelled` |
| `refunded` | `refunded` |
| `underpayment_email_reminder` | (tidak kirim ulang invoice — hanya WA reminder; email sudah dikirim dari tombol Operasi) |

Setelah **approve**, tetap tampilkan hasil auto-email di toast (seperti sekarang) + dialog WA; tombol **Kirim email** di dialog = kirim ulang bukti.

### 3. Tombol di detail registrasi

| Lokasi | Tombol |
| ------ | ------ |
| Operasi — penyesuaian | **Kirim tagihan kekurangan (email)** (rename dari "Kirim invoice via email") |
| Operasi / ringkasan — tanpa underpayment unpaid | **Kirim tagihan pendaftaran (email)** |
| Verifikasi — approved + email | **Kirim ulang bukti (email)** (existing, label diseragamkan) |
| Blast (toolbar daftar peserta) | Dua dialog: **Blast kekurangan** + **Blast tagihan pendaftaran** (preview terpisah) |

### 4. Pengaturan notifikasi

Form Owner: toggle auto-email per momen (tabel pref di atas). Copy jelas: otomatis hanya memanggil Resend bila `outboundMode = live`.

---

## Perubahan action server

| Action | Perubahan |
| ------ | --------- |
| `submitRegistration` | Setelah tx sukses: `trySendReceiptEmail` jika pref + email |
| `approveRegistration` | Tetap; hormati `emailAutoOnApprove` (false = skip auto, dialog manual saja) |
| `rejectRegistration` | Return `emailResult?`; client buka dialog; auto jika pref |
| `markPaymentIssue` | Sama |
| `cancelRegistration` / `refundRegistration` | Sama |
| `createAdminInvitation` | `renderAdminInviteEmail` dari DB |
| `auth` magic link | Sudah DB — tidak berubah |
| `buildTwoFactorPluginOptions` | OTP dari DB |

Return type pola (contoh):

```ts
type ActionResult<{ ok: true; email?: SendEmailResult | null }>
```

Email gagal **tidak** menggagalkan mutasi status (sama seperti approve hari ini).

---

## Blast tagihan pendaftaran

Mirror `previewInvoiceEmailBlast` / `runInvoiceEmailBlast`:

- **Eligible:** `contactEmail` not null, status ∉ `{rejected, cancelled, refunded}`, **tidak** punya underpayment unpaid, opsional filter tab/q sama seperti blast underpayment.
- **Template:** `invoice`
- **Batch:** delay kecil antar kirim, log per baris, ringkasan toast

---

## Migrasi & backward compatibility

1. Seed default body untuk key baru dari default WA (konversi ke blok via `migratePlainBodyToBlocks` / default blocks di katalog).
2. Baris `ClubEmailTemplate` kosong → fallback katalog (sudah ada).
3. Hapus atau deprecate `renderMagicLinkEmail` / komponen `MagicLinkEmail` jika tidak lagi dipakai — auth 100% `resolveMagicLinkEmailContent`.
4. Hapus `renderOtpEmail` / `AdminInviteEmail` hardcoded setelah migrasi auth.

---

## Pengujian

| Area | Cakupan |
| ---- | ------- |
| Katalog | Setiap enum punya entri; token wajib ada di validasi |
| Eligibility | Matriks status × key |
| Render | Snapshot HTML/text untuk tiap key dengan line items |
| Send | Mock Resend + prisma log |
| Actions | approve/reject/submit dengan pref on/off |
| Blast | Hitung eligible registration invoice vs underpayment |

---

## Urutan implementasi (untuk plan berikutnya)

1. **Migration** enum + preferensi notifikasi + seed katalog default.
2. **Fondasi:** lifecycle send helper, perluas katalog, selesaikan WIP line items/preview untuk semua key invoice/receipt/approved.
3. **Wire existing:** `invoice` kirim + blast; rename tombol; indeks admin.
4. **Lifecycle email:** render + send + actions return `emailResult`.
5. **Dialog terpadu** WA + email.
6. **Auth templates:** `admin_invite`, `otp`; hapus hardcoded.
7. **Dokumentasi:** `CLAUDE.md`, perbarui spec verifikasi komite dengan catatan email.

---

## Risiko

| Risiko | Mitigasi |
| ------ | -------- |
| Banyak email otomatis mengganggu peserta | Default auto hanya approve (+ receipt off) |
| OTP di template Owner salah edit | Token wajib + fallback default; preview di editor |
| Blast salah sasaran | Preview count + konfirmasi dialog; filter underpayment vs total terpisah |
| Migration enum di Postgres | `ADD VALUE` terpisah; deploy sebelum kode yang menulis key baru |

---

## Self-review (spec)

- [x] Tidak ada TBD — semua key dan trigger didefinisikan
- [x] Konsisten dengan WA catalog dan dialog verifikasi existing
- [x] Scope besar tetapi terbagi fase implementasi jelas
- [x] Perbedaan `invoice` vs `invoice_underpayment` eksplisit
- [x] Memperluas non-goal lama (receipt, OTP hardcoded) sesuai permintaan user
