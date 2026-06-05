# Verifikasi peserta — komunikasi terpadu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menggabungkan keputusan verifikasi dengan dialog WhatsApp opsional pasca-simpan, menghapus section Komunikasi terpisah, dan menambahkan dialog reminder WA di tab Operasi setelah email tagihan / cancel / refund.

**Architecture:** Helper murni `buildRegistrationWaNotify` menjadi satu sumber preview + `wa.me` href. Client `RegistrationNotifyDialog` dipakai ulang dari `DecisionSection` (verifikasi) dan `OperationsTabClient` (operasi). Server actions tidak berubah; dialog dibuka dari callback setelah `ActionResult.ok`.

**Tech Stack:** Next.js App Router (RSC + client islands), `@base-ui/react` Dialog, Vitest, Prisma `WaTemplateKey`, `render-*Message` + `waMeLink` yang sudah ada.

**Spec:** [`docs/superpowers/specs/2026-06-05-event-verification-comms-design.md`](../specs/2026-06-05-event-verification-comms-design.md)

---

## File map

| Path | Aksi |
| ---- | ---- |
| `src/lib/wa-templates/build-registration-notify.ts` | Create |
| `src/lib/wa-templates/build-registration-notify.test.ts` | Create |
| `src/lib/wa-templates/messages.ts` | Modify — `templateEmailInvoiceReminder` |
| `src/components/admin/registration-notify-dialog.tsx` | Create |
| `src/components/admin/registration-detail-panels/tab-verification/decision-section.tsx` | Modify — `use client`, dialog, kirim ulang |
| `src/components/admin/registration-actions.tsx` | Modify — `onNotify` callback |
| `src/components/admin/registration-detail-panels/tab-verification/verification-tab.tsx` | Modify — pass `waBodies`, hapus `CommunicationSection` |
| `src/components/admin/registration-detail-panels/tab-verification/communication-section.tsx` | Delete |
| `src/components/admin/send-invoice-email-button.tsx` | Modify — `onSuccess?` |
| `src/components/admin/invoice-adjustment-panel.tsx` | Modify — email + `onEmailSent?` per unpaid |
| `src/components/admin/registration-detail-panels/tab-operations/operations-tab.tsx` | Modify — delegasi ke client |
| `src/components/admin/registration-detail-panels/tab-operations/operations-tab-client.tsx` | Create |
| `src/components/admin/registration-detail-panels/tab-operations/invoice-adjustments-section.tsx` | Modify — pass notify props |
| `src/components/admin/cancel-refund-panel.tsx` | Modify — `onCancelSuccess` / `onRefundSuccess` |
| `src/components/admin/registration-detail-panels/tab-operations/cancel-refund-section.tsx` | Modify — wire callbacks |
| `CLAUDE.md` | Modify |

---

### Task 1: `buildRegistrationWaNotify` (TDD)

**Files:**
- Create: `src/lib/wa-templates/build-registration-notify.ts`
- Create: `src/lib/wa-templates/build-registration-notify.test.ts`
- Modify: `src/lib/wa-templates/messages.ts`

- [ ] **Step 1: Tambah template reminder email (kode, tanpa enum Prisma)**

Di `src/lib/wa-templates/messages.ts`, tambahkan:

```ts
export function templateEmailInvoiceReminder(c: {
  contactName: string
  eventTitle: string
  adjustmentAmountIdr: number
}): string {
  const amount = formatWaIdr(c.adjustmentAmountIdr)
  return (
    `Halo ${c.contactName},\n\n` +
    `Kami telah mengirim detail tagihan kekurangan ${amount} untuk acara ${c.eventTitle} ke email Anda. ` +
    `Mohon cek inbox dan folder spam.\n\n` +
    `Terima kasih.`
  )
}
```

(Pakai `formatWaIdr` yang sudah di-import di file yang sama.)

- [ ] **Step 2: Tulis tes gagal**

Buat `src/lib/wa-templates/build-registration-notify.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildRegistrationWaNotify } from '@/lib/wa-templates/build-registration-notify'

const baseReg = {
  contactName: 'Budi',
  contactWhatsapp: '081234567890',
  rejectionReason: 'Bukti tidak jelas',
  paymentIssueReason: 'Nominal kurang',
  computedTotalAtSubmit: 350_000,
  event: {
    title: 'Chelsea vs Milan',
    venueName: 'GBK',
    kickOffAt: new Date('2026-08-08T19:00:00+07:00'),
    bankAccount: { bankName: 'BCA', accountNumber: '123', accountName: 'CISC' },
  },
}

describe('buildRegistrationWaNotify', () => {
  it('approved — preview dan href valid', () => {
    const r = buildRegistrationWaNotify({
      kind: 'approved',
      registration: baseReg,
      waBodies: {},
    })
    expect(r.titleId).toContain('disetujui')
    expect(r.preview.length).toBeGreaterThan(10)
    expect(r.canOpen).toBe(true)
    expect(r.href).toMatch(/^https:\/\/wa\.me\/62/)
  })

  it('rejected — butuh alasan', () => {
    const r = buildRegistrationWaNotify({
      kind: 'rejected',
      registration: { ...baseReg, rejectionReason: null },
      waBodies: {},
    })
    expect(r.canOpen).toBe(false)
  })

  it('underpayment_email_reminder — menyebut acara dan nominal', () => {
    const r = buildRegistrationWaNotify({
      kind: 'underpayment_email_reminder',
      registration: baseReg,
      waBodies: {},
      adjustmentAmountIdr: 50_000,
    })
    expect(r.preview).toContain('Chelsea')
    expect(r.preview).toContain('50')
    expect(r.canOpen).toBe(true)
  })

  it('nomor tidak valid — canOpen false', () => {
    const r = buildRegistrationWaNotify({
      kind: 'approved',
      registration: { ...baseReg, contactWhatsapp: 'xxx' },
      waBodies: {},
    })
    expect(r.canOpen).toBe(false)
    expect(r.href).toBe('')
  })
})
```

- [ ] **Step 3: Jalankan tes — harus FAIL**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/wa-templates/build-registration-notify.test.ts
```

Expected: FAIL — modul belum ada.

- [ ] **Step 4: Implementasi helper**

Buat `src/lib/wa-templates/build-registration-notify.ts`:

```ts
import { WaTemplateKey } from '@prisma/client'

import { normalizeIdPhone, waMeLink } from '@/lib/wa-templates/encode'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'
import {
  renderApprovedMessage,
  renderCancelledMessage,
  renderPaymentIssueMessage,
  renderRefundedMessage,
  renderRejectedMessage,
} from '@/lib/wa-templates/render-wa-from-db'
import { templateEmailInvoiceReminder } from '@/lib/wa-templates/messages'

export type RegistrationNotifyKind =
  | 'approved'
  | 'rejected'
  | 'payment_issue'
  | 'cancelled'
  | 'refunded'
  | 'underpayment_email_reminder'

export type RegistrationNotifyInput = {
  contactName: string
  contactWhatsapp: string
  rejectionReason: string | null
  paymentIssueReason: string | null
  event: {
    title: string
    venueName: string
    kickOffAt: Date
  }
}

export type RegistrationNotifyPayload = {
  titleId: string
  preview: string
  href: string
  canOpen: boolean
  disabledReasonId: string | null
}

const TITLES: Record<RegistrationNotifyKind, string> = {
  approved: 'Pendaftaran disetujui',
  rejected: 'Pendaftaran ditolak',
  payment_issue: 'Kendala pembayaran',
  cancelled: 'Pendaftaran dibatalkan',
  refunded: 'Pengembalian dana',
  underpayment_email_reminder: 'Tagihan dikirim via email',
}

function phoneCanOpen(phone: string): boolean {
  const n = normalizeIdPhone(phone)
  return n.length >= 10 && n.startsWith('62')
}

export function buildRegistrationWaNotify(args: {
  kind: RegistrationNotifyKind
  registration: RegistrationNotifyInput
  waBodies: ClubWaBodies
  adjustmentAmountIdr?: number
}): RegistrationNotifyPayload {
  const { kind, registration: r, waBodies: wb } = args
  let preview = ''

  switch (kind) {
    case 'approved':
      preview = renderApprovedMessage(
        wb[WaTemplateKey.approved] ?? null,
        r.event.title,
        r.event.venueName,
        r.event.kickOffAt.toISOString(),
      )
      break
    case 'rejected':
      if (!r.rejectionReason?.trim()) {
        return {
          titleId: TITLES.rejected,
          preview: '',
          href: '',
          canOpen: false,
          disabledReasonId: 'Alasan penolakan belum diisi.',
        }
      }
      preview = renderRejectedMessage(wb[WaTemplateKey.rejected] ?? null, r.rejectionReason)
      break
    case 'payment_issue':
      if (!r.paymentIssueReason?.trim()) {
        return {
          titleId: TITLES.payment_issue,
          preview: '',
          href: '',
          canOpen: false,
          disabledReasonId: 'Alasan kendala pembayaran belum diisi.',
        }
      }
      preview = renderPaymentIssueMessage(wb[WaTemplateKey.payment_issue] ?? null, r.paymentIssueReason)
      break
    case 'cancelled':
      preview = renderCancelledMessage(wb[WaTemplateKey.cancelled] ?? null, r.contactName, r.event.title)
      break
    case 'refunded':
      preview = renderRefundedMessage(wb[WaTemplateKey.refunded] ?? null, r.contactName, r.event.title)
      break
    case 'underpayment_email_reminder':
      preview = templateEmailInvoiceReminder({
        contactName: r.contactName,
        eventTitle: r.event.title,
        adjustmentAmountIdr: args.adjustmentAmountIdr ?? 0,
      })
      break
  }

  const canOpen = phoneCanOpen(r.contactWhatsapp) && preview.length > 0
  const href = canOpen ? waMeLink(r.contactWhatsapp, preview) : ''

  return {
    titleId: TITLES[kind],
    preview,
    href,
    canOpen,
    disabledReasonId: canOpen ? null : 'Nomor WhatsApp tidak valid atau pesan kosong.',
  }
}

export function resendNotifyKindForStatus(
  status: import('@prisma/client').RegistrationStatus,
): RegistrationNotifyKind | null {
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  if (status === 'payment_issue') return 'payment_issue'
  return null
}
```

- [ ] **Step 5: Jalankan tes — harus PASS**

```bash
pnpm vitest run src/lib/wa-templates/build-registration-notify.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/wa-templates/messages.ts src/lib/wa-templates/build-registration-notify.ts src/lib/wa-templates/build-registration-notify.test.ts
git commit -m "feat(wa): helper buildRegistrationWaNotify untuk dialog admin"
```

---

### Task 2: `RegistrationNotifyDialog`

**Files:**
- Create: `src/components/admin/registration-notify-dialog.tsx`

- [ ] **Step 1: Buat komponen dialog**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { RegistrationNotifyPayload } from '@/lib/wa-templates/build-registration-notify'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: RegistrationNotifyPayload | null
}

export function RegistrationNotifyDialog({ open, onOpenChange, payload }: Props) {
  if (!payload) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{payload.titleId}</DialogTitle>
          <DialogDescription>Kirim notifikasi WhatsApp ke pendaftar? Pesan dapat diedit di aplikasi WhatsApp setelah dibuka.</DialogDescription>
        </DialogHeader>
        <pre className='max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap'>{payload.preview}</pre>
        {!payload.canOpen && payload.disabledReasonId ? (
          <p className='text-sm text-muted-foreground'>{payload.disabledReasonId}</p>
        ) : null}
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Lewati
          </Button>
          {payload.canOpen ? (
            <Button
              type='button'
              render={<a target='_blank' rel='noopener noreferrer' href={payload.href} />}
              onClick={() => onOpenChange(false)}
            >
              Buka WhatsApp
            </Button>
          ) : (
            <Button type='button' disabled>
              Buka WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Catatan:** Tombol primary memakai `render={<a href=... />}` agar navigasi native; tutup dialog saat klik.

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/registration-notify-dialog.tsx
git commit -m "feat(admin): RegistrationNotifyDialog pratinjau WA"
```

---

### Task 3: Tab Verifikasi — keputusan + dialog pasca-aksi

**Files:**
- Modify: `src/components/admin/registration-actions.tsx`
- Modify: `src/components/admin/registration-detail-panels/tab-verification/decision-section.tsx`
- Modify: `src/components/admin/registration-detail-panels/tab-verification/verification-tab.tsx`
- Delete: `src/components/admin/registration-detail-panels/tab-verification/communication-section.tsx`

- [ ] **Step 1: `RegistrationActions` — callback setelah sukses**

Tambah prop:

```ts
import type { RegistrationNotifyKind } from '@/lib/wa-templates/build-registration-notify'

type Props = {
  eventId: string
  registrationId: string
  onNotify?: (kind: RegistrationNotifyKind) => void
}
```

Di `handleApprove` setelah `toastCudSuccess`: `onNotify?.('approved')`  
Di `handleReject` setelah sukses: `onNotify?.('rejected')`  
Di `handlePaymentIssue` setelah sukses: `onNotify?.('payment_issue')`

- [ ] **Step 2: `DecisionSection` — client + dialog + kirim ulang**

Baris pertama file: `'use client'`.

Import `RegistrationNotifyDialog`, `buildRegistrationWaNotify`, `resendNotifyKindForStatus`, `ClubWaBodies`, `useState`.

Props tambahan: `waBodies: ClubWaBodies`.

State:

```ts
const [notifyOpen, setNotifyOpen] = useState(false)
const [notifyPayload, setNotifyPayload] = useState<RegistrationNotifyPayload | null>(null)

function openNotify(kind: RegistrationNotifyKind) {
  setNotifyPayload(buildRegistrationWaNotify({ kind, registration, waBodies }))
  setNotifyOpen(true)
}
```

Pass `onNotify={openNotify}` ke `RegistrationActions`.

Untuk status terminal (`isTerminal && !showActions`): di bawah ringkasan, jika `const resendKind = resendNotifyKindForStatus(registration.status)` dan payload `canOpen` atau preview ada, tampilkan:

```tsx
<Button type='button' variant='outline' size='sm' onClick={() => resendKind && openNotify(resendKind)}>
  Kirim ulang notifikasi
</Button>
```

Sembunyikan tombol bila `buildRegistrationWaNotify` mengembalikan `canOpen === false` **dan** `preview === ''` (rejected/payment_issue tanpa alasan).

Render `<RegistrationNotifyDialog open={notifyOpen} onOpenChange={setNotifyOpen} payload={notifyPayload} />` di akhir.

- [ ] **Step 3: `verification-tab.tsx`**

- Hapus import dan pemakaian `CommunicationSection`.
- Pass `waBodies` ke `DecisionSection`.
- Update `CardDescription`: hilangkan “tautan WhatsApp” terpisah; ganti mis. “Keputusan verifikasi dan notifikasi WhatsApp opsional.”

- [ ] **Step 4: Hapus `communication-section.tsx`**

```bash
git rm src/components/admin/registration-detail-panels/tab-verification/communication-section.tsx
```

- [ ] **Step 5: Manual smoke**

1. Buka registrasi `pending_review` → Approve → dialog muncul → Lewati / Buka WA.
2. Registrasi `approved` → **Kirim ulang notifikasi** membuka dialog tanpa ubah status.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/registration-actions.tsx \
  src/components/admin/registration-detail-panels/tab-verification/decision-section.tsx \
  src/components/admin/registration-detail-panels/tab-verification/verification-tab.tsx
git commit -m "feat(admin): dialog WA pasca-keputusan verifikasi"
```

---

### Task 4: Tab Operasi — email tagihan + cancel/refund

**Files:**
- Modify: `src/components/admin/send-invoice-email-button.tsx`
- Modify: `src/components/admin/invoice-adjustment-panel.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-operations/operations-tab-client.tsx`
- Modify: `src/components/admin/registration-detail-panels/tab-operations/operations-tab.tsx`
- Modify: `src/components/admin/registration-detail-panels/tab-operations/invoice-adjustments-section.tsx`
- Modify: `src/components/admin/cancel-refund-panel.tsx`
- Modify: `src/components/admin/registration-detail-panels/tab-operations/cancel-refund-section.tsx`
- Modify: `src/components/admin/registration-detail-panels/registration-detail-shell.tsx` (pass `waBodies` ke OperationsTab)

- [ ] **Step 1: `SendInvoiceEmailButton` — `onSuccess?`**

```ts
onSuccess?: () => void
```

Setelah `toastCudSuccess`, panggil `onSuccess?.()`.

- [ ] **Step 2: `InvoiceAdjustmentPanel` — tombol email per unpaid**

Props baru:

```ts
contactEmail: string | null
contactName: string
eventTitle: string
onUnderpaymentEmailSent?: (adjustmentAmountIdr: number) => void
```

Di setiap baris `adj.status === unpaid`, tambahkan (jika `contactEmail`):

```tsx
<SendInvoiceEmailButton
  eventId={eventId}
  registrationId={registrationId}
  onSuccess={() => onUnderpaymentEmailSent?.(adj.amount)}
/>
```

Jika `!contactEmail`, teks kecil: “Email kontak kosong — tidak dapat kirim invoice.”

- [ ] **Step 3: `operations-tab-client.tsx`**

Client wrapper yang memegang `notifyOpen` / `notifyPayload` (sama pola Task 3).

Props: `eventId`, `registration: DetailRegistration`, `waBodies`.

Handler:

```ts
function onUnderpaymentEmailSent(amount: number) {
  openNotify('underpayment_email_reminder', amount)
}
```

`openNotify` memanggil `buildRegistrationWaNotify` dengan `adjustmentAmountIdr`.

Render `AttendanceSection`, `InvoiceAdjustmentsSection` (pass handler + email fields), `CancelRefundSection` dengan callback cancel/refund.

`CancelRefundPanel`: tambah `onCancelSuccess?: () => void`, `onRefundSuccess?: () => void` — panggil setelah toast sukses.

- [ ] **Step 4: `operations-tab.tsx` — thin server wrapper**

```tsx
import { OperationsTabClient } from './operations-tab-client'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'

export function OperationsTab({ eventId, registration, waBodies }: Props & { waBodies: ClubWaBodies }) {
  return <OperationsTabClient eventId={eventId} registration={registration} waBodies={waBodies} />
}
```

- [ ] **Step 5: `registration-detail-shell.tsx`**

Pada panel `operasi`, pass `waBodies={waBodies}` ke `OperationsTab`.

- [ ] **Step 6: Smoke Operasi**

1. Registrasi dengan adjustment `unpaid` + `contactEmail` → Kirim invoice via email → dialog reminder.
2. Cancel / refund → dialog `cancelled` / `refunded`.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/send-invoice-email-button.tsx \
  src/components/admin/invoice-adjustment-panel.tsx \
  src/components/admin/registration-detail-panels/tab-operations/*.tsx \
  src/components/admin/cancel-refund-panel.tsx \
  src/components/admin/registration-detail-panels/registration-detail-shell.tsx
git commit -m "feat(admin): dialog WA reminder di tab Operasi"
```

---

### Task 5: Dokumentasi `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Perbarui bagian UI components / tab Verifikasi & Operasi**

- Tab Verifikasi: keputusan + dialog WA pasca-simpan; section Komunikasi terpisah dihapus; receipt tidak ditampilkan v1.
- Tab Operasi: tombol kirim email tagihan di panel penyesuaian; pasca-email/cancel/refund → `RegistrationNotifyDialog`.
- Tambah modul `lib/wa-templates/build-registration-notify.ts` di Key library modules.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md verifikasi peserta dialog WA"
```

---

## Spec coverage (self-review)

| Requirement spec | Task |
| ---------------- | ---- |
| Dialog setelah approve/reject/payment issue | Task 3 |
| Hapus section Komunikasi | Task 3 |
| Receipt dihilangkan | Task 3 (tidak ditambahkan) |
| Kirim ulang status terminal | Task 3 |
| Email tagihan di Operasi + dialog reminder | Task 4 |
| Cancel/refund dialog WA | Task 4 |
| Helper satu sumber preview/href | Task 1 |
| Server actions tidak berubah | Semua task |
| Edge case nomor invalid | Task 1 + Task 2 |
| CLAUDE.md | Task 5 |

**Keputusan v1:** Reminder email pakai `templateEmailInvoiceReminder` di kode (tanpa enum `email_reminder` / migrasi Prisma).

---

## Execution handoff

Plan disimpan di `docs/superpowers/plans/2026-06-05-event-verification-comms-implementation.md`.

**Opsi eksekusi:**

1. **Subagent-Driven (disarankan)** — satu subagent per task, review antar task  
2. **Inline Execution** — jalankan task berurutan di sesi ini (`executing-plans`)

Mau yang mana?
