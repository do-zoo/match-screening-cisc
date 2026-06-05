# Unduh & lampiran PDF tagihan registrasi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin dapat pratinjau dan unduh PDF tagihan (awal + per penyesuaian) dari detail peserta; email `invoice` / `invoice_underpayment` melampirkan PDF yang sama bila Owner mengaktifkan preferensi komite.

**Architecture:** Modul `lib/invoices/*` memuat data + eligibility + komponen `@react-pdf/renderer`; route `GET .../invoice-pdf` untuk pratinjau/unduh; `sendTransactionalEmail` diperluas dengan `attachments`; toggle `emailAttachInvoicePdf` di `ClubNotificationPreferences`.

**Tech Stack:** Next.js App Router, Prisma, `@react-pdf/renderer`, Resend, Vitest, TypeScript.

**Spec:** [`docs/superpowers/specs/2026-06-05-registration-invoice-pdf-design.md`](../specs/2026-06-05-registration-invoice-pdf-design.md)

---

## File map

| File | Tanggung jawab |
| ---- | -------------- |
| `prisma/schema.prisma` | Field `emailAttachInvoicePdf` |
| `prisma/migrations/...` | Migrasi baru |
| `src/lib/forms/club-notification-preferences-schema.ts` | Zod boolean baru |
| `src/lib/public/load-club-notification-preferences.ts` | VM + default |
| `src/lib/actions/admin-club-notification-preferences.ts` | Save + audit metadata |
| `src/app/admin/settings/notifications/page.tsx` | Pass initial ke form |
| `src/components/admin/club-notification-preferences-form.tsx` | Toggle UI |
| `src/lib/invoices/registration-invoice-pdf-types.ts` | `InvoicePdfKind`, view-model types |
| `src/lib/invoices/registration-invoice-pdf-eligibility.ts` | `canDownloadRegistrationInvoicePdf` |
| `src/lib/invoices/registration-invoice-pdf-eligibility.test.ts` | Matrix status |
| `src/lib/invoices/registration-invoice-pdf-filename.ts` | `buildInvoicePdfFilename` |
| `src/lib/invoices/registration-invoice-pdf-filename.test.ts` | Pola nama file |
| `src/lib/invoices/registration-invoice-pdf-data.ts` | `loadRegistrationInvoicePdfData` |
| `src/lib/invoices/registration-invoice-pdf-data.test.ts` | Loader + not found |
| `src/lib/invoices/registration-invoice-pdf-doc.tsx` | Layout PDF tetap |
| `src/lib/invoices/render-registration-invoice-pdf.ts` | `renderRegistrationInvoicePdf` |
| `src/lib/invoices/render-registration-invoice-pdf.test.ts` | Buffer smoke |
| `src/lib/invoices/build-registration-invoice-pdf-url.ts` | URL untuk iframe/unduh |
| `src/lib/invoices/build-registration-invoice-pdf-url.test.ts` | Query params |
| `src/lib/invoices/try-build-invoice-email-attachment.ts` | Attachment untuk pipeline email |
| `src/app/api/admin/events/[eventId]/registrants/[registrationId]/invoice-pdf/route.tsx` | GET handler |
| `src/lib/auth/send-transactional-email.ts` | `attachments` → Resend base64 |
| `src/lib/auth/send-transactional-email.test.ts` | Assert attachment payload |
| `src/lib/email/send-registration-email.ts` | Wire attachment bila prefs on |
| `src/lib/email/send-registration-email.test.ts` | Mock PDF + prefs |
| `src/components/admin/registration-invoice-pdf-dialog.tsx` | Dialog iframe + unduh |
| `src/components/admin/registration-invoice-pdf-button.tsx` | Trigger header |
| `src/components/admin/registration-detail-panels/registration-detail-header.tsx` | Slot tombol tagihan |
| `src/components/admin/registration-detail-panels/registration-detail-shell.tsx` | Pass props eligibility |
| `src/components/admin/invoice-adjustment-panel.tsx` | Tombol per baris |
| `CLAUDE.md` | Route, modul, field, komponen |

---

### Task 1: Schema & preferensi Owner (`emailAttachInvoicePdf`)

**Files:**
- Modify: `prisma/schema.prisma` (model `ClubNotificationPreferences`)
- Create: migration via CLI
- Modify: `src/lib/forms/club-notification-preferences-schema.ts`
- Modify: `src/lib/public/load-club-notification-preferences.ts`
- Modify: `src/lib/actions/admin-club-notification-preferences.ts`
- Modify: `src/app/admin/settings/notifications/page.tsx`
- Modify: `src/components/admin/club-notification-preferences-form.tsx`

- [ ] **Step 1: Tambah field Prisma**

Di `ClubNotificationPreferences`, setelah `emailAutoOnRefund`:

```prisma
emailAttachInvoicePdf Boolean @default(true)
```

- [ ] **Step 2: Jalankan migrasi dev**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm db:migrate:dev --name add_email_attach_invoice_pdf
```

Expected: migrasi sukses, `prisma generate` otomatis.

- [ ] **Step 3: Perluas Zod schema**

```ts
// src/lib/forms/club-notification-preferences-schema.ts — tambah di object:
emailAttachInvoicePdf: z.preprocess(formBoolean, z.boolean()),
```

- [ ] **Step 4: Perluas loader VM**

```ts
// src/lib/public/load-club-notification-preferences.ts
export type ClubNotificationPrefsVm = {
  // ...existing fields
  emailAttachInvoicePdf: boolean
}

// di return loadClubNotificationPreferences:
emailAttachInvoicePdf: row?.emailAttachInvoicePdf ?? true,
```

- [ ] **Step 5: Save action — parse + upsert + audit metadata**

Di `saveClubNotificationPreferences`:
- `formData.get('emailAttachInvoicePdf')` di `safeParse`
- Field di `create` / `update` upsert
- `metadata: { ..., emailAttachInvoicePdf: parsed.data.emailAttachInvoicePdf }`

- [ ] **Step 6: Form toggle**

Di `club-notification-preferences-form.tsx`, props `initialEmailAuto` tambah `emailAttachInvoicePdf: boolean`.

Setelah blok `emailAutoOnRefund`, tambah:

```tsx
<EmailAutoToggle
  id='emailAttachInvoicePdf'
  name='emailAttachInvoicePdf'
  label='Lampirkan PDF tagihan pada email invoice'
  description='Berlaku untuk email tagihan pendaftaran dan kekurangan bayar (kirim manual, blast, dan otomatis).'
  initialChecked={props.initialEmailAuto.emailAttachInvoicePdf}
  pending={pending}
/>
```

Di `notifications/page.tsx`:

```tsx
emailAttachInvoicePdf: row?.emailAttachInvoicePdf ?? true,
```

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/lib/forms/club-notification-preferences-schema.ts src/lib/public/load-club-notification-preferences.ts src/lib/actions/admin-club-notification-preferences.ts src/app/admin/settings/notifications/page.tsx src/components/admin/club-notification-preferences-form.tsx
git commit -m "feat: toggle Owner lampirkan PDF tagihan pada email invoice"
```

---

### Task 2: Eligibility & filename helpers

**Files:**
- Create: `src/lib/invoices/registration-invoice-pdf-types.ts`
- Create: `src/lib/invoices/registration-invoice-pdf-eligibility.ts`
- Create: `src/lib/invoices/registration-invoice-pdf-eligibility.test.ts`
- Create: `src/lib/invoices/registration-invoice-pdf-filename.ts`
- Create: `src/lib/invoices/registration-invoice-pdf-filename.test.ts`

- [ ] **Step 1: Types**

```ts
// src/lib/invoices/registration-invoice-pdf-types.ts
export type InvoicePdfKind = 'registration' | 'adjustment'

export type InvoicePdfPaymentStatus = 'awaiting_payment' | 'unpaid_adjustment' | 'paid'

export type RegistrationInvoicePdfVm = {
  kind: InvoicePdfKind
  paymentStatus: InvoicePdfPaymentStatus
  issuedAt: Date
  clubNameNav: string
  committeeContactEmail: string | null
  registrationId: string
  adjustmentId: string | null
  contactName: string
  eventTitle: string
  eventSlug: string
  venueName: string
  kickOffAt: Date
  ticketCategoryName: string
  ticketQty: number
  registrationTotalIdr: number
  adjustmentAmountIdr: number | null
  paidAt: Date | null
  lineItems: Array<{ label: string; value: string; note?: string }>
  bank: { bankName: string; accountNumber: string; accountName: string } | null
}
```

- [ ] **Step 2: Failing eligibility tests**

```ts
// src/lib/invoices/registration-invoice-pdf-eligibility.test.ts
import { RegistrationStatus } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { canDownloadRegistrationInvoicePdf } from './registration-invoice-pdf-eligibility'

describe('canDownloadRegistrationInvoicePdf', () => {
  it('allows registration invoice for non-terminal statuses', () => {
    for (const status of [
      RegistrationStatus.submitted,
      RegistrationStatus.pending_review,
      RegistrationStatus.payment_issue,
      RegistrationStatus.approved,
    ]) {
      expect(canDownloadRegistrationInvoicePdf({ kind: 'registration', registrationStatus: status })).toBe(true)
    }
  })

  it('blocks registration invoice for terminal statuses', () => {
    for (const status of [
      RegistrationStatus.rejected,
      RegistrationStatus.cancelled,
      RegistrationStatus.refunded,
    ]) {
      expect(canDownloadRegistrationInvoicePdf({ kind: 'registration', registrationStatus: status })).toBe(false)
    }
  })

  it('always allows adjustment when row exists', () => {
    expect(
      canDownloadRegistrationInvoicePdf({
        kind: 'adjustment',
        registrationStatus: RegistrationStatus.cancelled,
      }),
    ).toBe(true)
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/invoices/registration-invoice-pdf-eligibility.test.ts
```

- [ ] **Step 4: Implement eligibility + filename**

```ts
// src/lib/invoices/registration-invoice-pdf-eligibility.ts
import { RegistrationStatus } from '@prisma/client'
import type { InvoicePdfKind } from './registration-invoice-pdf-types'

const TERMINAL: RegistrationStatus[] = [
  RegistrationStatus.rejected,
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
]

export function canDownloadRegistrationInvoicePdf(input: {
  kind: InvoicePdfKind
  registrationStatus: RegistrationStatus
}): boolean {
  if (input.kind === 'adjustment') return true
  return !TERMINAL.includes(input.registrationStatus)
}
```

```ts
// src/lib/invoices/registration-invoice-pdf-filename.ts
import type { InvoicePdfKind } from './registration-invoice-pdf-types'

function slugSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'acara'
}

export function buildInvoicePdfFilename(input: {
  kind: InvoicePdfKind
  eventSlug: string
  registrationId: string
  adjustmentId?: string | null
}): string {
  const slug = slugSafe(input.eventSlug)
  if (input.kind === 'adjustment' && input.adjustmentId) {
    return `penyesuaian-${slug}-${input.adjustmentId.slice(0, 8)}.pdf`
  }
  return `tagihan-${slug}-${input.registrationId.slice(0, 8)}.pdf`
}
```

- [ ] **Step 5: Filename tests + run all Task 2 tests**

```ts
// src/lib/invoices/registration-invoice-pdf-filename.test.ts
import { describe, expect, it } from 'vitest'
import { buildInvoicePdfFilename } from './registration-invoice-pdf-filename'

describe('buildInvoicePdfFilename', () => {
  it('builds registration filename', () => {
    expect(
      buildInvoicePdfFilename({
        kind: 'registration',
        eventSlug: 'nobar-final',
        registrationId: 'clxyz1234567890',
      }),
    ).toBe('tagihan-nobar-final-clxyz123.pdf')
  })

  it('builds adjustment filename', () => {
    expect(
      buildInvoicePdfFilename({
        kind: 'adjustment',
        eventSlug: 'nobar final',
        registrationId: 'reg1',
        adjustmentId: 'adjabcdefgh',
      }),
    ).toBe('penyesuaian-nobar-final-adjabcde.pdf')
  })
})
```

```bash
pnpm vitest run src/lib/invoices/registration-invoice-pdf-eligibility.test.ts src/lib/invoices/registration-invoice-pdf-filename.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/invoices/
git commit -m "feat: eligibility dan nama file PDF tagihan registrasi"
```

---

### Task 3: Data loader (`loadRegistrationInvoicePdfData`)

**Files:**
- Create: `src/lib/invoices/registration-invoice-pdf-data.ts`
- Create: `src/lib/invoices/registration-invoice-pdf-data.test.ts`

- [ ] **Step 1: Failing loader test (mock Prisma)**

```ts
// src/lib/invoices/registration-invoice-pdf-data.test.ts
import { RegistrationStatus, InvoiceAdjustmentStatus } from '@prisma/client'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    registration: { findFirst: vi.fn() },
    invoiceAdjustment: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/public/load-club-branding', () => ({
  loadPublicClubBranding: vi.fn().mockResolvedValue({
    clubNameNav: 'CISC',
    contactEmail: 'info@cisc.test',
    websiteUrl: null,
    locationText: null,
    socialLinks: [],
  }),
  pickClubEmailContact: vi.fn(b => ({ contactEmail: b.contactEmail })),
}))

import { prisma } from '@/lib/db/prisma'
import { loadRegistrationInvoicePdfData } from './registration-invoice-pdf-data'

describe('loadRegistrationInvoicePdfData', () => {
  beforeEach(() => {
    vi.mocked(prisma.registration.findFirst).mockReset()
    vi.mocked(prisma.invoiceAdjustment.findFirst).mockReset()
  })

  it('returns error when registration missing', async () => {
    vi.mocked(prisma.registration.findFirst).mockResolvedValue(null)
    const res = await loadRegistrationInvoicePdfData({
      eventId: 'ev1',
      registrationId: 'reg1',
      kind: 'registration',
    })
    expect(res).toEqual({ ok: false, error: 'Pendaftaran tidak ditemukan.' })
  })

  it('returns vm for approved registration invoice', async () => {
    vi.mocked(prisma.registration.findFirst).mockResolvedValue({
      id: 'reg12345678',
      status: RegistrationStatus.approved,
      contactName: 'Budi',
      computedTotalAtSubmit: 500_000,
      ticketQty: 2,
      ticketCategory: { name: 'Reguler' },
      tickets: [
        {
          sortOrder: 1,
          ticketPriceApplied: 250_000,
          assignedHolder: { holderName: 'Budi' },
          mandatoryMenuItem: { name: 'Nasi' },
        },
      ],
      event: {
        title: 'Nobar',
        slug: 'nobar',
        kickOffAt: new Date('2026-06-10T10:00:00Z'),
        venue: { name: 'Studio' },
        bankAccount: { bankName: 'BCA', accountNumber: '123', accountName: 'CISC' },
      },
    } as never)

    const res = await loadRegistrationInvoicePdfData({
      eventId: 'ev1',
      registrationId: 'reg12345678',
      kind: 'registration',
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.paymentStatus).toBe('paid')
      expect(res.data.registrationTotalIdr).toBe(500_000)
      expect(res.data.bank).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm vitest run src/lib/invoices/registration-invoice-pdf-data.test.ts
```

- [ ] **Step 3: Implement loader**

```ts
// src/lib/invoices/registration-invoice-pdf-data.ts
import {
  InvoiceAdjustmentStatus,
  RegistrationStatus,
} from '@prisma/client'

import { prisma } from '@/lib/db/prisma'
import { buildTicketLineItems } from '@/lib/email-templates/email-transaction-line-items'
import { loadPublicClubBranding, pickClubEmailContact } from '@/lib/public/load-club-branding'
import { canDownloadRegistrationInvoicePdf } from './registration-invoice-pdf-eligibility'
import type { InvoicePdfKind, RegistrationInvoicePdfVm } from './registration-invoice-pdf-types'

export type LoadRegistrationInvoicePdfResult =
  | { ok: true; data: RegistrationInvoicePdfVm }
  | { ok: false; error: string }

const registrationSelect = {
  id: true,
  status: true,
  contactName: true,
  computedTotalAtSubmit: true,
  ticketQty: true,
  ticketCategory: { select: { name: true } },
  tickets: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      sortOrder: true,
      ticketPriceApplied: true,
      assignedHolder: { select: { holderName: true } },
      mandatoryMenuItem: { select: { name: true } },
    },
  },
  event: {
    select: {
      title: true,
      slug: true,
      kickOffAt: true,
      venue: { select: { name: true } },
      bankAccount: { select: { bankName: true, accountNumber: true, accountName: true } },
    },
  },
} as const

export async function loadRegistrationInvoicePdfData(input: {
  eventId: string
  registrationId: string
  kind: InvoicePdfKind
  adjustmentId?: string
}): Promise<LoadRegistrationInvoicePdfResult> {
  const registration = await prisma.registration.findFirst({
    where: { id: input.registrationId, eventId: input.eventId },
    select: registrationSelect,
  })

  if (!registration) return { ok: false, error: 'Pendaftaran tidak ditemukan.' }

  if (
    !canDownloadRegistrationInvoicePdf({
      kind: input.kind,
      registrationStatus: registration.status,
    })
  ) {
    return { ok: false, error: 'Tagihan tidak tersedia untuk status ini.' }
  }

  const branding = await loadPublicClubBranding()
  const committeeEmail = pickClubEmailContact(branding).contactEmail
  const lineItems = buildTicketLineItems(registration.tickets)
  const bank = registration.event.bankAccount

  if (input.kind === 'registration') {
    const isPaid = registration.status === RegistrationStatus.approved
    const vm: RegistrationInvoicePdfVm = {
      kind: 'registration',
      paymentStatus: isPaid ? 'paid' : 'awaiting_payment',
      issuedAt: new Date(),
      clubNameNav: branding.clubNameNav,
      committeeContactEmail: committeeEmail,
      registrationId: registration.id,
      adjustmentId: null,
      contactName: registration.contactName,
      eventTitle: registration.event.title,
      eventSlug: registration.event.slug,
      venueName: registration.event.venue.name,
      kickOffAt: registration.event.kickOffAt,
      ticketCategoryName: registration.ticketCategory.name,
      ticketQty: registration.ticketQty,
      registrationTotalIdr: registration.computedTotalAtSubmit,
      adjustmentAmountIdr: null,
      paidAt: null,
      lineItems,
      bank: isPaid || !bank ? null : bank,
    }
    return { ok: true, data: vm }
  }

  if (!input.adjustmentId?.trim()) {
    return { ok: false, error: 'ID penyesuaian wajib untuk tagihan penyesuaian.' }
  }

  const adjustment = await prisma.invoiceAdjustment.findFirst({
    where: {
      id: input.adjustmentId,
      registrationId: registration.id,
    },
    select: { id: true, amount: true, status: true, paidAt: true },
  })

  if (!adjustment) return { ok: false, error: 'Penyesuaian tidak ditemukan.' }

  const isPaid = adjustment.status === InvoiceAdjustmentStatus.paid
  const vm: RegistrationInvoicePdfVm = {
    kind: 'adjustment',
    paymentStatus: isPaid ? 'paid' : 'unpaid_adjustment',
    issuedAt: new Date(),
    clubNameNav: branding.clubNameNav,
    committeeContactEmail: committeeEmail,
    registrationId: registration.id,
    adjustmentId: adjustment.id,
    contactName: registration.contactName,
    eventTitle: registration.event.title,
    eventSlug: registration.event.slug,
    venueName: registration.event.venue.name,
    kickOffAt: registration.event.kickOffAt,
    ticketCategoryName: registration.ticketCategory.name,
    ticketQty: registration.ticketQty,
    registrationTotalIdr: registration.computedTotalAtSubmit,
    adjustmentAmountIdr: adjustment.amount,
    paidAt: adjustment.paidAt,
    lineItems,
    bank: isPaid || !bank ? null : bank,
  }
  return { ok: true, data: vm }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm vitest run src/lib/invoices/registration-invoice-pdf-data.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/registration-invoice-pdf-data.ts src/lib/invoices/registration-invoice-pdf-data.test.ts
git commit -m "feat: loader data PDF tagihan registrasi"
```

---

### Task 4: PDF document & render

**Files:**
- Create: `src/lib/invoices/registration-invoice-pdf-doc.tsx`
- Create: `src/lib/invoices/render-registration-invoice-pdf.ts`
- Create: `src/lib/invoices/render-registration-invoice-pdf.test.ts`

- [ ] **Step 1: PDF document component**

Ikuti pola `export-pdf/route.tsx` (Helvetica, A4, `StyleSheet.create`). Label status Indonesia:

| `paymentStatus` | Teks badge |
| --------------- | ---------- |
| `awaiting_payment` | Menunggu pembayaran |
| `unpaid_adjustment` | Belum lunas |
| `paid` | Lunas |

Judul: `Tagihan Pendaftaran` atau `Tagihan Penyesuaian`.

Gunakan `formatCurrencyIdr` dari `registration-detail-panels/shared/format.ts` untuk nominal.

Tabel line items: map `vm.lineItems` — kolom Deskripsi / Nominal / Catatan.

Footer: `committeeContactEmail` bila ada; bila `paidAt` → baris "Lunas pada {format tanggal WIB}".

- [ ] **Step 2: Render wrapper**

```ts
// src/lib/invoices/render-registration-invoice-pdf.ts
import { renderToBuffer } from '@react-pdf/renderer'

import { buildInvoicePdfFilename } from './registration-invoice-pdf-filename'
import { RegistrationInvoicePdfDocument } from './registration-invoice-pdf-doc'
import type { RegistrationInvoicePdfVm } from './registration-invoice-pdf-types'

export async function renderRegistrationInvoicePdf(vm: RegistrationInvoicePdfVm): Promise<{
  buffer: Buffer
  filename: string
  contentType: 'application/pdf'
}> {
  const buffer = await renderToBuffer(<RegistrationInvoicePdfDocument vm={vm} />)
  const filename = buildInvoicePdfFilename({
    kind: vm.kind,
    eventSlug: vm.eventSlug,
    registrationId: vm.registrationId,
    adjustmentId: vm.adjustmentId,
  })
  return { buffer, filename, contentType: 'application/pdf' }
}
```

- [ ] **Step 3: Smoke test**

```ts
// src/lib/invoices/render-registration-invoice-pdf.test.ts
import { describe, expect, it } from 'vitest'
import { renderRegistrationInvoicePdf } from './render-registration-invoice-pdf'
import type { RegistrationInvoicePdfVm } from './registration-invoice-pdf-types'

const baseVm: RegistrationInvoicePdfVm = {
  kind: 'registration',
  paymentStatus: 'awaiting_payment',
  issuedAt: new Date('2026-06-05T12:00:00Z'),
  clubNameNav: 'CISC',
  committeeContactEmail: 'info@test.com',
  registrationId: 'reg12345678',
  adjustmentId: null,
  contactName: 'Budi',
  eventTitle: 'Nobar',
  eventSlug: 'nobar',
  venueName: 'Studio',
  kickOffAt: new Date('2026-06-10T10:00:00Z'),
  ticketCategoryName: 'Reguler',
  ticketQty: 1,
  registrationTotalIdr: 100_000,
  adjustmentAmountIdr: null,
  paidAt: null,
  lineItems: [{ label: 'Tiket #1 · Budi', value: 'Rp 100.000' }],
  bank: { bankName: 'BCA', accountNumber: '123', accountName: 'CISC' },
}

describe('renderRegistrationInvoicePdf', () => {
  it('returns non-empty PDF buffer', async () => {
    const res = await renderRegistrationInvoicePdf(baseVm)
    expect(res.contentType).toBe('application/pdf')
    expect(res.buffer.byteLength).toBeGreaterThan(500)
    expect(res.filename).toMatch(/^tagihan-nobar-reg12345\.pdf$/)
  })
})
```

- [ ] **Step 4: Run**

```bash
pnpm vitest run src/lib/invoices/render-registration-invoice-pdf.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/registration-invoice-pdf-doc.tsx src/lib/invoices/render-registration-invoice-pdf.ts src/lib/invoices/render-registration-invoice-pdf.test.ts
git commit -m "feat: render PDF tagihan registrasi dengan layout tetap"
```

---

### Task 5: Route handler & URL builder

**Files:**
- Create: `src/lib/invoices/build-registration-invoice-pdf-url.ts`
- Create: `src/lib/invoices/build-registration-invoice-pdf-url.test.ts`
- Create: `src/app/api/admin/events/[eventId]/registrants/[registrationId]/invoice-pdf/route.tsx`

- [ ] **Step 1: URL builder test + impl**

```ts
// src/lib/invoices/build-registration-invoice-pdf-url.ts
import type { InvoicePdfKind } from './registration-invoice-pdf-types'

export function buildRegistrationInvoicePdfUrl(input: {
  eventId: string
  registrationId: string
  kind: InvoicePdfKind
  adjustmentId?: string
  disposition?: 'inline' | 'attachment'
}): string {
  const params = new URLSearchParams({
    kind: input.kind,
    disposition: input.disposition ?? 'inline',
  })
  if (input.adjustmentId) params.set('adjustmentId', input.adjustmentId)
  return `/api/admin/events/${input.eventId}/registrants/${input.registrationId}/invoice-pdf?${params.toString()}`
}
```

```ts
// build-registration-invoice-pdf-url.test.ts — assert path + query
```

- [ ] **Step 2: Route handler**

```tsx
// src/app/api/admin/events/[eventId]/registrants/[registrationId]/invoice-pdf/route.tsx
import { NextRequest, NextResponse } from 'next/server'

import { guardEvent, isAuthError } from '@/lib/actions/guard'
import { loadRegistrationInvoicePdfData } from '@/lib/invoices/registration-invoice-pdf-data'
import { renderRegistrationInvoicePdf } from '@/lib/invoices/render-registration-invoice-pdf'
import type { InvoicePdfKind } from '@/lib/invoices/registration-invoice-pdf-types'

function parseKind(raw: string | null): InvoicePdfKind | null {
  if (raw === 'registration' || raw === 'adjustment') return raw
  return null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; registrationId: string }> },
) {
  const { eventId, registrationId } = await params

  try {
    await guardEvent(eventId)
  } catch (e) {
    if (isAuthError(e)) {
      const status = e instanceof Error && e.message === 'UNAUTHENTICATED' ? 401 : 403
      return new NextResponse('Tidak diizinkan.', { status })
    }
    throw e
  }

  const kind = parseKind(req.nextUrl.searchParams.get('kind'))
  if (!kind) return new NextResponse('Jenis tagihan tidak valid.', { status: 400 })

  const adjustmentId = req.nextUrl.searchParams.get('adjustmentId') ?? undefined
  const disposition = req.nextUrl.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline'

  const loaded = await loadRegistrationInvoicePdfData({
    eventId,
    registrationId,
    kind,
    adjustmentId,
  })

  if (!loaded.ok) {
    const status = loaded.error.includes('tidak ditemukan') ? 404 : 400
    return new NextResponse(loaded.error, { status })
  }

  try {
    const { buffer, filename } = await renderRegistrationInvoicePdf(loaded.data)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
      },
    })
  } catch {
    return new NextResponse('Gagal membuat PDF.', { status: 500 })
  }
}
```

- [ ] **Step 3: Run URL tests**

```bash
pnpm vitest run src/lib/invoices/build-registration-invoice-pdf-url.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/invoices/build-registration-invoice-pdf-url.ts src/lib/invoices/build-registration-invoice-pdf-url.test.ts src/app/api/admin/events/
git commit -m "feat: route unduh dan pratinjau PDF tagihan registrasi"
```

---

### Task 6: Lampiran email (Resend + pipeline)

**Files:**
- Modify: `src/lib/auth/send-transactional-email.ts`
- Modify: `src/lib/auth/send-transactional-email.test.ts`
- Create: `src/lib/invoices/try-build-invoice-email-attachment.ts`
- Modify: `src/lib/email/send-registration-email.ts`
- Create: `src/lib/email/send-registration-email.test.ts`

- [ ] **Step 1: Extend sendTransactionalEmail**

```ts
// send-transactional-email.ts
export type SendTransactionalEmailInput = {
  to: string
  subject: string
  text: string
  html?: string
  attachments?: Array<{ filename: string; content: Buffer }>
}

// dalam resend.emails.send:
...(input.attachments?.length
  ? {
      attachments: input.attachments.map(a => ({
        filename: a.filename,
        content: a.content,
      })),
    }
  : {}),
```

Resend Node SDK menerima `content` sebagai `Buffer` — verifikasi di test.

- [ ] **Step 2: Test attachment forwarding**

Tambah di `send-transactional-email.test.ts`:

```ts
it('forwards attachments to resend', async () => {
  // stub env, mockSend
  const buf = Buffer.from('%PDF-1.4 fake')
  await sendTransactionalEmail({
    to: 'user@example.com',
    subject: 'Tagihan',
    text: 'Lihat lampiran',
    attachments: [{ filename: 'tagihan.pdf', content: buf }],
  })
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      attachments: [expect.objectContaining({ filename: 'tagihan.pdf' })],
    }),
  )
})
```

- [ ] **Step 3: try-build-invoice-email-attachment**

```ts
// src/lib/invoices/try-build-invoice-email-attachment.ts
import { EmailTemplateKey } from '@prisma/client'

import { loadRegistrationInvoicePdfData } from './registration-invoice-pdf-data'
import { renderRegistrationInvoicePdf } from './render-registration-invoice-pdf'

export async function tryBuildInvoiceEmailAttachment(input: {
  eventId: string
  registrationId: string
  templateKey: EmailTemplateKey
  unpaidAdjustmentId?: string | null
}): Promise<{ filename: string; content: Buffer } | null> {
  if (
    input.templateKey !== EmailTemplateKey.invoice &&
    input.templateKey !== EmailTemplateKey.invoice_underpayment
  ) {
    return null
  }

  const kind = input.templateKey === EmailTemplateKey.invoice ? 'registration' : 'adjustment'
  const loaded = await loadRegistrationInvoicePdfData({
    eventId: input.eventId,
    registrationId: input.registrationId,
    kind,
    adjustmentId: kind === 'adjustment' ? input.unpaidAdjustmentId ?? undefined : undefined,
  })

  if (!loaded.ok) return null

  try {
    const rendered = await renderRegistrationInvoicePdf(loaded.data)
    return { filename: rendered.filename, content: rendered.buffer }
  } catch (e) {
    console.error('[tryBuildInvoiceEmailAttachment]', e)
    return null
  }
}
```

- [ ] **Step 4: Wire sendRegistrationEmailByKey**

Di `sendRegistrationEmailByKey`, setelah `renderForKey` dan sebelum `sendTransactionalEmail`:

```ts
let attachments: Array<{ filename: string; content: Buffer }> | undefined

if (
  prefs.emailAttachInvoicePdf &&
  (opts.templateKey === EmailTemplateKey.invoice ||
    opts.templateKey === EmailTemplateKey.invoice_underpayment)
) {
  const unpaidAdj = reg.adjustments[0] // sudah di-load untuk underpayment
  const attachment = await tryBuildInvoiceEmailAttachment({
    eventId: opts.eventId,
    registrationId: reg.id,
    templateKey: opts.templateKey,
    unpaidAdjustmentId: unpaidAdj?.id ?? null,
  })
  if (attachment) attachments = [attachment]
}

await sendTransactionalEmail({ to: toEmail, subject, text, html, attachments })
```

Perlu perluas `loadRegistrationForEmail` untuk underpayment: tambah `select: { id: true }` pada adjustments query (bukan hanya `amount`).

- [ ] **Step 5: Email pipeline test (mock PDF helper)**

```ts
// src/lib/email/send-registration-email.test.ts — vi.mock prisma, tryBuildInvoiceEmailAttachment, sendTransactionalEmail
// Assert: prefs on + invoice key → sendTransactionalEmail called with attachments
// Assert: prefs off → no attachments
```

- [ ] **Step 6: Run tests**

```bash
pnpm vitest run src/lib/auth/send-transactional-email.test.ts src/lib/email/send-registration-email.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/send-transactional-email.ts src/lib/auth/send-transactional-email.test.ts src/lib/invoices/try-build-invoice-email-attachment.ts src/lib/email/send-registration-email.ts src/lib/email/send-registration-email.test.ts
git commit -m "feat: lampirkan PDF tagihan pada email invoice bila prefs Owner aktif"
```

---

### Task 7: UI admin (dialog, header, adjustment)

**Files:**
- Create: `src/components/admin/registration-invoice-pdf-dialog.tsx`
- Create: `src/components/admin/registration-invoice-pdf-button.tsx`
- Modify: `src/components/admin/registration-detail-panels/registration-detail-header.tsx`
- Modify: `src/components/admin/registration-detail-panels/registration-detail-shell.tsx`
- Modify: `src/components/admin/invoice-adjustment-panel.tsx`

- [ ] **Step 1: Dialog component**

```tsx
// registration-invoice-pdf-dialog.tsx — 'use client'
// Props: open, onOpenChange, title, previewUrl, downloadUrl
// Dialog @base-ui: DialogTrigger pakai render prop bila perlu
// Body: iframe className="h-[70vh] w-full rounded-md border" src={previewUrl}
// Footer: <a href={downloadUrl} download>Unduh PDF</a> + Tutup
// title: "Pratinjau tagihan pendaftaran" / "Pratinjau tagihan penyesuaian"
```

`previewUrl` = `buildRegistrationInvoicePdfUrl({ ..., disposition: 'inline' })`  
`downloadUrl` = same dengan `disposition: 'attachment'`

- [ ] **Step 2: Button wrapper**

```tsx
// registration-invoice-pdf-button.tsx — 'use client'
// Props: label, dialogTitle, previewUrl, downloadUrl, variant='outline' | 'ghost'
// State open + RegistrationInvoicePdfDialog
// Icon: FileDown dari lucide-react
```

- [ ] **Step 3: Header — tampilkan tombol tagihan awal**

Di `registration-detail-header.tsx` tambah props opsional:

```tsx
invoicePdfAction?: React.ReactNode
```

Render di baris kanan dekat badge status (`flex` wrap).

Di `registration-detail-shell.tsx`:
- Import `canDownloadRegistrationInvoicePdf`, `buildRegistrationInvoicePdfUrl`, `RegistrationInvoicePdfButton`
- Bila eligible `kind: 'registration'`, pass tombol ke header

- [ ] **Step 4: Adjustment panel — tombol per baris**

Di `invoice-adjustment-panel.tsx`, pada setiap baris adjustment tambah:

```tsx
<RegistrationInvoicePdfButton
  label='Tagihan'
  dialogTitle='Pratinjau tagihan penyesuaian'
  previewUrl={buildRegistrationInvoicePdfUrl({
    eventId,
    registrationId,
    kind: 'adjustment',
    adjustmentId: adj.id,
    disposition: 'inline',
  })}
  downloadUrl={buildRegistrationInvoicePdfUrl({
    eventId,
    registrationId,
    kind: 'adjustment',
    adjustmentId: adj.id,
    disposition: 'attachment',
  })}
  variant='ghost'
/>
```

`buildRegistrationInvoicePdfUrl` boleh dipanggil di client (helper pure, no server-only imports).

- [ ] **Step 5: Manual smoke**

```bash
pnpm dev
```

1. Buka detail peserta `pending_review` → header punya tombol Tagihan → dialog iframe tampil PDF
2. Tab Operasi → baris penyesuaian punya tombol Tagihan
3. `admin/settings/notifications` → toggle lampiran PDF tersimpan

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/registration-invoice-pdf-dialog.tsx src/components/admin/registration-invoice-pdf-button.tsx src/components/admin/registration-detail-panels/ src/components/admin/invoice-adjustment-panel.tsx
git commit -m "feat: UI pratinjau dan unduh PDF tagihan di detail peserta"
```

---

### Task 8: Dokumentasi & verifikasi akhir

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Tambahkan di **Route layout**:

```
- `api/admin/events/[eventId]/registrants/[registrationId]/invoice-pdf` — GET PDF tagihan (`?kind=`, `?adjustmentId=`, `?disposition=`)
```

Tambahkan di **Data model** (`ClubNotificationPreferences`):

```
- `emailAttachInvoicePdf Boolean @default(true)` — lampirkan PDF pada email invoice / underpayment
```

Tambahkan di **Key library modules**:

```
- `lib/invoices/*` — eligibility, data, render PDF tagihan registrasi; `try-build-invoice-email-attachment.ts`
- `components/admin/registration-invoice-pdf-dialog.tsx` — pratinjau iframe + unduh
```

- [ ] **Step 2: Run full test suite**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm test
```

Expected: all pass

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: catat modul PDF tagihan registrasi di CLAUDE.md"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| PDF tagihan awal + penyesuaian | Task 2–5 |
| Status eligibility | Task 2 |
| Layout PDF tetap | Task 4 |
| Pratinjau dialog iframe | Task 7 |
| Header + Operasi placement | Task 7 |
| Route auth guardEvent | Task 5 |
| Toggle Owner emailAttachInvoicePdf | Task 1 |
| Lampiran email invoice/underpayment | Task 6 |
| Gagal PDF → email tetap kirim | Task 6 (`tryBuild` returns null) |
| CLAUDE.md | Task 8 |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-registration-invoice-pdf-plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch subagent per task, review antar task, iterasi cepat
2. **Inline Execution** — jalankan task berurutan di sesi ini dengan checkpoint review

Which approach?
