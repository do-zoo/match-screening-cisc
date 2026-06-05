---
title: Unduh & lampiran PDF tagihan registrasi (admin)
date: 2026-06-05
project: match-screening
status: approved
related:
  - 2026-06-05-branding-contact-icons-design.md
  - 2026-06-05-email-layout-branding-design.md
---

# Unduh & lampiran PDF tagihan registrasi (admin)

## Problem

Admin sudah bisa mengirim tagihan lewat email (`invoice`, `invoice_underpayment`) dari halaman detail peserta dan blast, tetapi **tidak ada dokumen PDF** untuk pratinjau, unduhan manual, atau arsip. Verifier sering perlu membagikan tagihan lewat saluran lain (WA, cetak) tanpa menyalin isi email. Peserta juga belum menerima lampiran PDF terstruktur saat email tagihan dikirim.

## Goal

1. **Unduh & pratinjau PDF** tagihan dari halaman detail peserta (`/admin/events/[eventId]/registrants/[registrationId]`).
2. Dukung **tagihan pendaftaran awal** dan **tagihan per penyesuaian** (`InvoiceAdjustment`), termasuk yang **sudah lunas** (arsip).
3. **Lampirkan PDF yang sama** pada email `invoice` dan `invoice_underpayment` bila Owner mengaktifkan preferensi komite.
4. Layout PDF **tetap (fixed)** — tidak mengikuti blok template email yang bisa dikustom.

## Locked product decisions (brainstorming)

| Topic | Decision |
| ----- | -------- |
| Jenis dokumen | Tagihan awal + per `InvoiceAdjustment`; ketersediaan **tergantung status** registrasi |
| Format | **PDF** + **pratinjau** dialog modal (iframe) |
| Konten PDF | **B** — layout tetap admin (bukan render dari template email) |
| Penempatan UI | **D** — header untuk tagihan awal; tab Operasi per baris penyesuaian |
| Pratinjau | **A** — dialog + iframe; file unduhan = file pratinjau |
| Lampiran email | **C** — toggle global Owner di `ClubNotificationPreferences` |
| Pendekatan teknis | Route handler + `@react-pdf/renderer` (selaras export PDF kepengurusan) |
| Bahasa UI / error | Indonesia |
| Auth unduhan | `guardEvent` + sesi admin (sama route admin lain) |

## Out of scope (v1)

- PDF untuk template email selain `invoice` / `invoice_underpayment` (receipt, approved, dll.)
- Checkbox per-kirim di dialog admin (hanya toggle global Owner)
- Lampiran di blast dengan strategi berbeda dari kirim tunggal
- Penyimpanan PDF persisten di Vercel Blob
- Unduhan publik tanpa login admin
- Logo klub custom per acara di PDF (hanya teks nama klub dari branding)
- Sinkronisasi layout PDF dengan blok template email Owner

---

## Eligibility — kapan unduh tersedia

### Tagihan pendaftaran awal (`kind=registration`)

| `RegistrationStatus` | Tombol di header | Label status di PDF |
| -------------------- | ---------------- | ------------------- |
| `submitted` | Ya | Menunggu pembayaran |
| `pending_review` | Ya | Menunggu pembayaran |
| `payment_issue` | Ya | Menunggu pembayaran |
| `approved` | Ya | Lunas |
| `rejected` | Tidak | — |
| `cancelled` | Tidak | — |
| `refunded` | Tidak | — |

### Tagihan penyesuaian (`kind=adjustment`, wajib `adjustmentId`)

| Kondisi | Tombol di baris adjustment | Label status di PDF |
| ------- | -------------------------- | ------------------- |
| Baris `InvoiceAdjustment` ada | Ya | Belum lunas (`unpaid`) atau Lunas (`paid`) |
| `paidAt` terisi | Ya | Tampilkan tanggal lunas di footer PDF |

Penyesuaian **tetap dapat diunduh** pada registrasi terminal (`cancelled`, `refunded`) selama baris adjustment masih ada (arsip). Tagihan awal disembunyikan pada status terminal.

Email attachment eligibility mengikuti `canSendRegistrationEmail` yang sudah ada — PDF hanya dilampirkan bila email memang terkirim.

---

## Isi PDF (layout tetap)

Satu generator dipakai untuk unduhan admin dan lampiran email.

### Header

- Nama klub: `ClubBranding.clubNameNav`
- Judul: **Tagihan Pendaftaran** atau **Tagihan Penyesuaian**
- Badge status (Menunggu pembayaran / Belum lunas / Lunas)
- ID registrasi (monospace) + tanggal terbit (WIB, format konsisten admin)

### Penerima & acara

- Nama kontak (`contactName`)
- Kategori tiket, jumlah tiket
- Judul acara, nama venue, tanggal kick-off (`kickOffAt`)

### Rincian transaksi

- Tabel tiket per baris: holder, menu wajib (jika ada), harga IDR
- Sumber data: reuse `buildTicketLineItems` dari `lib/email-templates/email-transaction-line-items.ts`
- Total:
  - Tagihan awal: `computedTotalAtSubmit`
  - Penyesuaian: `InvoiceAdjustment.amount` + konteks total pendaftaran awal (opsional satu baris referensi)

### Instruksi pembayaran

- Tampilkan blok rekening (`event.bankAccount`) **hanya** bila status PDF = belum lunas
- Format: bank, nomor rekening, atas nama

### Footer

- Email kontak komite: `pickClubEmailContact` dari branding
- Bila lunas: catatan arsip + `paidAt` untuk penyesuaian

### Nama file

| Kind | Pola |
| ---- | ---- |
| `registration` | `tagihan-{eventSlug}-{registrationId8}.pdf` |
| `adjustment` | `penyesuaian-{eventSlug}-{adjustmentId8}.pdf` |

`registrationId8` / `adjustmentId8` = 8 karakter pertama ID (cukup unik untuk operator).

---

## Architecture

### Modul baru (`src/lib/invoices/`)

| File | Responsibility |
| ---- | -------------- |
| `registration-invoice-pdf-types.ts` | `InvoicePdfKind`, input/output types |
| `registration-invoice-pdf-eligibility.ts` | `canDownloadRegistrationInvoicePdf`, `canAttachInvoicePdfToEmail` |
| `registration-invoice-pdf-data.ts` | Muat Prisma + validasi; return view-model untuk PDF |
| `registration-invoice-pdf-doc.tsx` | Komponen `@react-pdf/renderer` (`Document`, `Page`, tabel) |
| `render-registration-invoice-pdf.ts` | `renderRegistrationInvoicePdf()` → `{ buffer, filename, contentType }` |

### Route handler

```
GET /api/admin/events/[eventId]/registrants/[registrationId]/invoice-pdf
  ?kind=registration|adjustment
  &adjustmentId=<cuid>   (wajib jika kind=adjustment)
  &disposition=inline|attachment   (default: inline)
```

**Auth flow:**

1. `requireAdminSession()`
2. `guardEvent(eventId)` — throws → 401/403
3. Validasi query + eligibility → 400/404 dengan pesan Indonesia di body teks

**Response headers:**

- `Content-Type: application/pdf`
- `Content-Disposition: inline` atau `attachment; filename="..."`

### UI admin

| Komponen | Lokasi | Perilaku |
| -------- | ------ | -------- |
| `RegistrationInvoicePdfDialog` | `components/admin/` | Dialog + iframe `src` route `disposition=inline` + tombol Unduh |
| `RegistrationInvoicePdfButton` | Header detail | Buka dialog `kind=registration`; sembunyi bila tidak eligible |
| Tombol per adjustment | `InvoiceAdjustmentPanel` | Buka dialog `kind=adjustment` + `adjustmentId` |

Props dialog menerima `previewUrl` (string) yang dibangun di server component atau helper `buildRegistrationInvoicePdfUrl(...)`.

### Email attachment

**Schema** — tambah ke `ClubNotificationPreferences`:

```prisma
emailAttachInvoicePdf Boolean @default(true)
```

**Migrasi Prisma** wajib; default `true` agar perilaku baru aktif untuk instalasi existing.

**UI** — `club-notification-preferences-form.tsx`, seksi email transaksional:

- Label: **Lampirkan PDF tagihan pada email invoice**
- Deskripsi: Berlaku untuk email tagihan pendaftaran dan kekurangan bayar (manual, blast, otomatis).

**Mutasi** — `saveClubNotificationPreferences` (Owner + `appendClubAuditLog` dengan action existing `NOTIFICATION_PREFS_SAVED`).

**Pipeline kirim** — perluasan:

1. `sendTransactionalEmail` — tambah field opsional:

```ts
attachments?: Array<{ filename: string; content: Buffer }>
```

Resend: encode `content` sebagai base64 di API call.

2. `sendRegistrationEmailByKey` — setelah `renderForKey`, bila:
   - `templateKey` ∈ `{ invoice, invoice_underpayment }`
   - `prefs.emailAttachInvoicePdf === true`
   - registrasi eligible

   maka panggil `renderRegistrationInvoicePdf()` (kind sesuai template; underpayment pakai unpaid adjustment terbaru) dan pass ke `sendTransactionalEmail`.

3. **Gagal generate PDF:** log error, kirim email **tanpa** lampiran (jangan gagalkan pengiriman).

`previewRegistrationEmailContent` **tidak** perlu menampilkan lampiran — pratinjau email tetap teks/HTML seperti sekarang. Admin memakai dialog PDF terpisah untuk pratinjau dokumen.

---

## Data flow

```
DetailRegistration (page) ──► RegistrationInvoicePdfButton
                                    │
                                    ▼
                    RegistrationInvoicePdfDialog (iframe)
                                    │
                                    ▼
              GET invoice-pdf route ──► load pdf data ──► renderToBuffer
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            disposition=inline              disposition=attachment
            (pratinjau)                     (unduh)

sendRegistrationEmailByKey
  → render email HTML/text
  → [if emailAttachInvoicePdf] renderRegistrationInvoicePdf
  → sendTransactionalEmail({ ..., attachments })
  → EmailDeliveryLog (unchanged schema)
```

---

## Error handling

| Case | Behavior |
| ---- | -------- |
| Tidak login / tidak boleh verifikasi acara | 401 / 403 |
| `kind=adjustment` tanpa `adjustmentId` | 400 — pesan Indonesia |
| Adjustment tidak milik registrasi | 404 |
| Status tidak eligible unduh | 404 atau 403 — "Tagihan tidak tersedia untuk status ini." |
| Registrasi tidak ditemukan | 404 |
| PDF render throw | Route: 500; Email: skip attachment, kirim email |
| `emailAttachInvoicePdf` false | Email tanpa attachment (unchanged) |
| Mode outbound `log_only` / `off` | Tidak kirim ke Resend (unchanged); PDF tidak relevan |

---

## Testing

| Test | File |
| ---- | ---- |
| Eligibility per status/kind | `registration-invoice-pdf-eligibility.test.ts` |
| Data loader + filename | `registration-invoice-pdf-data.test.ts` |
| Render buffer non-empty | `render-registration-invoice-pdf.test.ts` |
| Route auth + disposition headers | `invoice-pdf/route.test.ts` atau integration |
| Email dengan attachment bila prefs on | `send-registration-email.test.ts` (extend) |
| Email tanpa attachment bila prefs off / PDF gagal | same |
| Schema + save prefs toggle | `club-notification-preferences` action test |

---

## Documentation

Update `CLAUDE.md`:

- Route: `api/admin/events/[eventId]/registrants/[registrationId]/invoice-pdf`
- Modul: `lib/invoices/*`
- Field `ClubNotificationPreferences.emailAttachInvoicePdf`
- Komponen: `RegistrationInvoicePdfDialog`, tombol di header + adjustment panel

---

## Implementation order

1. Prisma migration + prefs form + save action
2. `lib/invoices/*` (eligibility, data, PDF doc, render)
3. Route handler + tests
4. `sendTransactionalEmail` attachments + wire di `sendRegistrationEmailByKey`
5. UI dialog + tombol header + tombol per adjustment
6. `CLAUDE.md`

---

## Approaches considered

| Approach | Verdict |
| -------- | ------- |
| Route handler + `@react-pdf/renderer` | **Selected** — pola export kepengurusan |
| Server Action return buffer | Rejected — awkward untuk iframe pratinjau |
| HTML → headless PDF | Rejected — dependensi berat, tidak ada di stack |
| Layout PDF = template email blok | Rejected — terlalu dinamis, tidak cocok arsip |
| Checkbox per-kirim | Rejected — user pilih toggle Owner global |
| Lampiran hanya kirim manual | Rejected — user pilih toggle global untuk semua jalur kirim |
