---
title: Email member, peserta, template, dan blast invoice
date: 2026-06-06
project: match-screening
status: approved-in-chat
---

# Email — direktori, pendaftaran, template, blast invoice

## Problem

- Direktori `MasterMember` dan data pendaftaran belum menyimpan email, sehingga tidak ada saluran resmi untuk mengirim tagihan/invoice digital.
- Template pesan WhatsApp sudah ada di Pengaturan, tetapi tidak ada padanan untuk email.
- Operator membutuhkan **blast invoice** per acara ke pendaftar yang punya kekurangan bayar dan alamat email kontak.

## Goal

1. Tambah field email di **direktori member** (opsional) dan **pendaftaran** (kontak wajib untuk pendaftar baru; per-holder opsional).
2. Satu halaman **Template pesan** dengan tab **WhatsApp** (existing) dan **Email** (invoice + magic link).
3. **Blast email invoice** per acara + kirim tunggal dari detail registrasi.
4. Magic link admin memakai subject/body dari DB dengan fallback aman.

---

## Locked product decisions

| Topic | Decision |
| ----- | -------- |
| Email `MasterMember` | **Opsional**; normalisasi lowercase + trim; validasi format email |
| Email kontak pendaftaran | **`contactEmail` wajib** untuk submit baru; legacy boleh `null` |
| Email holder | **`holderEmail` opsional** per `RegistrationHolder` |
| Form publik | Wajib segera; tidak ada fase opsional |
| Pre-fill | Lookup member → isi email kontak (dan holder utama jika primary-only) dari `MasterMember.email` bila ada |
| UI template | **Satu menu** `/admin/settings/templates` — tab **WA** \| **Email**; redirect dari URL WA lama |
| Template email v1 | Hanya **`invoice_underpayment`** dan **`magic_link`** |
| Format template | Plain **subject** + **body** + placeholder `{token}`; validasi token wajib seperti WA |
| OTP 2FA email | **Tetap hardcoded** di kode (bukan template DB v1) |
| Blast v1 | Preview + konfirmasi + batch **best effort**; log per pengiriman |
| Penerima blast | Hanya **`Registration.contactEmail`** |
| Kriteria blast | Acara ini + adjustment `underpayment` **unpaid** + email terisi; exclude `rejected` / `cancelled` / `refunded` |
| Saluran live | `ClubNotificationPreferences.outboundMode` — `off` / `log_only` / `live` (sama untuk stub blast) |
| Provider | Resend via `sendTransactionalEmail` (env `RESEND_API_KEY`, `AUTH_TRANSACTIONAL_FROM`) |
| Akses template | **Owner** (`canManageCommitteeAdvancedSettings`) |
| Akses blast | **`guardEvent`** + `canVerifyEvent` |
| Arsitektur data template | **UI gabung, tabel terpisah**: `ClubWaTemplate` + `ClubEmailTemplate` |

---

## Schema (Prisma)

### Field baru

```prisma
model MasterMember {
  // ...
  email String?
}

model Registration {
  // ...
  contactEmail String?
}

model RegistrationHolder {
  // ...
  holderEmail String?
}

enum EmailTemplateKey {
  invoice_underpayment
  magic_link
}

model ClubEmailTemplate {
  key       EmailTemplateKey @id
  subject   String
  body      String           @db.Text
  updatedAt DateTime         @updatedAt
}

model EmailDeliveryLog {
  id                  String           @id @default(cuid())
  eventId             String
  registrationId      String
  templateKey         EmailTemplateKey
  toEmail             String
  success             Boolean
  errorMessage        String?          @db.VarChar(500)
  actorAdminProfileId String?
  actorAuthUserId     String
  createdAt           DateTime         @default(now())

  @@index([eventId, createdAt(sort: Desc)])
  @@index([registrationId])
}
```

**Catatan:** `contactEmail` nullable di DB untuk migrasi; aplikasi menolak submit baru tanpa email.

---

## Normalisasi & validasi

- **Normalisasi penyimpanan:** `trim` + lowercase untuk `MasterMember.email`, `Registration.contactEmail`, `RegistrationHolder.holderEmail`.
- **Validasi:** Zod `.email('Format email tidak valid.')` pada create/update/submit.
- **CSV direktori:** kolom `email` opsional; sel kosong = tidak ubah field (partial update); format invalid = baris gagal impor.
- **Uniqueness:** tidak ada unique global pada email (satu alamat bisa dipakai beberapa member/kontak).

---

## Template pesan (Pengaturan)

### Rute & navigasi

| Sebelum | Sesudah |
| ------- | ------- |
| `/admin/settings/whatsapp-templates` | `/admin/settings/templates?tab=wa` |
| Label nav "Template WhatsApp" | **"Template pesan"** |

- **Redirect permanen** `whatsapp-templates` → `templates?tab=wa` (`next.config.ts` atau halaman redirect).
- Layout guard Owner: pindah ke `src/app/admin/settings/templates/layout.tsx`.

### Tab WhatsApp

- Panel `ClubWaTemplatesPanel` tidak berubah fungsional.
- Actions `saveClubWaTemplateBody` / `resetClubWaTemplateBody` tetap; `revalidatePath` diperbarui ke `/admin/settings/templates`.

### Tab Email

Dua kartu:

| Key | Label admin |
| --- | ----------- |
| `invoice_underpayment` | Tagihan kekurangan bayar |
| `magic_link` | Magic link masuk admin |

**Placeholder wajib:**

| Key | Tokens |
| --- | ------ |
| `invoice_underpayment` | `contact_name`, `event_title`, `adjustment_amount_idr`, `bank_name`, `account_number`, `account_name` |
| `magic_link` | `magic_link_url` |

**Opsional:** `registration_id` (invoice), `club_name_nav` (magic link).

**Perilaku:**

- Default subject/body di `lib/email-templates/default-bodies.ts` (mirror pola `CLUB_WA_DEFAULT_BODIES`).
- `validateEmailTemplate(key, subject, body)` — subject tidak kosong; body tidak kosong; semua token wajib ada.
- Render: `applyEmailPlaceholders` (reuse atau fork dari `applyWaPlaceholders`).
- Simpan/reset: `saveClubEmailTemplate`, `resetClubEmailTemplate` — `guardOwner()`, `ActionResult`, `appendClubAuditLog` (`club.email_template.save` / `reset`).
- Preview statis di UI dengan data contoh (tanpa kirim).

### Magic link runtime

- `auth.ts` `sendMagicLink`: muat template DB; subject + `text` dari hasil render; **HTML** = wrapper React Email (`MagicLinkEmail`) dengan CTA `url` + paragraf dari baris teks template.
- Fallback penuh ke perilaku hardcoded sekarang jika DB kosong / validasi gagal.
- **OTP 2FA** tidak memakai `ClubEmailTemplate` di v1.

---

## Form pendaftaran & admin

### Publik (`RegistrationForm`)

- Step kontak: input **Email** wajib di samping nama/WhatsApp.
- Holder card: input **Email** opsional (label jelas: opsional).
- Submit: `contactEmail` wajib; `holderEmail` per holder opsional.
- Server `submit-registration`: validasi + normalisasi; simpan snapshot di DB.

### Admin

- **Direktori** (`member-form-dialog`, CSV): field email opsional.
- **Detail registrasi** (operasi/ringkasan): edit `contactEmail` + holder emails (server action dengan `guardEvent`).
- Pendaftaran legacy tanpa email: tampilkan peringatan; blast melewati baris tersebut.

### Pre-fill member lookup

- Saat klaim member Tangsel berhasil: jika `MasterMember.email` ada → set field email kontak (dan holder #1 jika `requireAllHolderData === false`).

---

## Blast invoice per acara

### UI

- Lokasi: toolbar `/admin/events/[eventId]/registrants` — tombol **"Kirim invoice (email)"**.
- Dialog:
  - Ringkasan preview (`eligible`, `skippedNoEmail`, `skippedNoAdjustment`, `skippedStatus`)
  - Checkbox opsional: **"Batasi ke filter status tab saat ini"** (gunakan `tab` dari query URL)
  - Konfirmasi → jalankan blast

### Server actions

1. `previewInvoiceEmailBlast(eventId, opts)` — `guardEvent`, read-only counts + sample ids (opsional cap 5 untuk debug UI).
2. `runInvoiceEmailBlast(eventId, opts)` — `guardEvent`, loop eligible registrations.

**Query eligible (inti):**

```text
eventId = :eventId
AND contactEmail IS NOT NULL
AND status NOT IN (rejected, cancelled, refunded)
AND EXISTS (
  InvoiceAdjustment WHERE registrationId = Registration.id
  AND type = underpayment AND status = unpaid
)
```

Jika `respectListTab`: tambahkan filter status dari `registrationListWhere` yang sudah ada.

**Pengiriman:**

- Render `invoice_underpayment` dengan konteks adjustment **unpaid** (jika beberapa, pakai yang **terbaru** `createdAt`).
- Bank dari `Event.bankAccount` / relasi yang dipakai WA invoice hari ini.
- `outboundMode === 'off'` → `rootError` sebelum loop.
- `log_only` → `console.log('[email-blast]', …)` + tulis `EmailDeliveryLog` dengan `success: true` dan metadata mode (atau flag terpisah — pilih satu: log di DB tetap dengan `success: true` dan `errorMessage: 'log_only'` dilarang; lebih baik field opsional `dryRun` di log — **v1 simplification:** log_only tidak tulis DB, hanya console).
- `live` → Resend; log sukses/gagal per row.

**Throttle:** sequential await atau chunk 5 dengan jeda 200ms antar chunk.

**Hasil:** `ActionResult<{ sent, failed, skipped }>` + toast Indonesia.

### Kirim tunggal

- Tab **Verifikasi & Komunikasi**: tombol **"Kirim invoice via email"** bila eligible (sama query satu registrasi); reuse `sendInvoiceEmailToRegistration(registrationId)`.

---

## Library modules (target)

| Modul | Tanggung jawab |
| ----- | -------------- |
| `lib/email/normalize-email.ts` | normalize + validate helper |
| `lib/email-templates/email-placeholder.ts` | `{token}` apply + policy |
| `lib/email-templates/default-bodies.ts` | default subject/body |
| `lib/email-templates/render-invoice-email.ts` | render invoice dari DB + ctx |
| `lib/email-templates/render-magic-link-email.ts` | subject/text untuk auth |
| `lib/actions/admin-club-email-templates.ts` | save/reset Owner |
| `lib/actions/admin-invoice-email-blast.ts` | preview + run + single send |
| `lib/email/send-invoice-email.ts` | outbound mode + Resend + log |

Update `CLAUDE.md` saat implementasi: route templates, model enum, modul di atas.

---

## Error handling

| Kasus | Respons |
| ----- | ------- |
| Resend tidak dikonfigurasi | `rootError`: email pengiriman belum dikonfigurasi |
| `outboundMode === off` | Blast ditolak |
| Template invalid di DB | Fallback default hardcoded; magic link tetap kirim |
| Registrasi tanpa email | Dilewati di blast; hitung di `skippedNoEmail` |
| Resend API error per row | `failed++`, log `success: false` + pesan singkat |

Semua pesan user-facing **Bahasa Indonesia**; toast via `toastCudSuccess` / `toastActionErr`.

---

## Testing (Vitest)

- `normalize-email` / validasi Zod schema registrasi & member.
- `validateEmailTemplate` — token wajib, body kosong.
- `render-invoice-email` — placeholder terisi, fallback default.
- `previewInvoiceEmailBlast` query logic (mock Prisma) — eligible vs skipped.
- Blast `log_only` tidak memanggil Resend (mock `sendTransactionalEmail`).

---

## Out of scope (YAGNI v1)

- Template email untuk receipt/approved/rejected (tetap WA saja).
- Visual/HTML email builder; lampiran PDF invoice.
- Blast ke `holderEmail` (hanya kontak).
- Unsubscribe / preferensi per pengguna.
- Provider selain Resend.
- OTP 2FA sebagai template DB.
- Penggabungan tabel `ClubWaTemplate` + `ClubEmailTemplate` menjadi satu model.

---

## Implementation order (suggested)

1. Migrasi Prisma + normalize helper.
2. Member directory + CSV + form dialog email.
3. Registration public + server submit + admin edit contact/holder email.
4. `ClubEmailTemplate` + tab Email + refactor rute templates + redirect.
5. Magic link wired ke template DB.
6. `EmailDeliveryLog` + single send + blast UI/actions.
7. Tests + `CLAUDE.md` update.

---

## Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Resend rate limit pada blast besar | Throttle + preview count; dokumentasikan batas operator |
| Legacy tanpa email | Skip + admin edit manual; banner di daftar peserta acara (opsional) |
| Template magic link rusak | Fallback hardcoded; token `magic_link_url` wajib |
| PII di log server | `log_only` jangan log full body; hanya to + registrationId |
