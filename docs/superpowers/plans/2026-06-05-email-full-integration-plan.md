# Email full integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelaraskan semua email transaksional (11 `EmailTemplateKey`) dengan action server dan UX admin — termasuk paritas WA, blast tagihan pendaftaran, dialog WA+email, dan template OTP/undangan di DB.

**Architecture:** Migrasi Prisma menambah enum + preferensi auto-email; katalog blok + `sendRegistrationEmailByKey` sebagai jalur kirim tunggal; render per kelompok (invoice, lifecycle, auth); action memanggil `trySend*` tanpa gagalkan mutasi; UI memperluas dialog dan blast yang sudah ada.

**Tech Stack:** Prisma/Neon, Next.js App Router, Zod, Resend, React Email (`renderEmailFromBlocks`), Vitest, Better Auth.

**Spec:** [`docs/superpowers/specs/2026-06-05-email-full-integration-design.md`](../specs/2026-06-05-email-full-integration-design.md)

**Prasyarat terminal:** `cd` repo root → `nvm use` → perintah `pnpm` / Prisma.

---

## File map (target akhir)

| File | Tanggung jawab |
| ---- | -------------- |
| `prisma/schema.prisma` | +7 enum values; +6 boolean di `ClubNotificationPreferences` |
| `prisma/migrations/*_email_full_integration/` | `ADD VALUE` + kolom pref |
| `src/lib/email/registration-email-eligibility.ts` | `canSendRegistrationEmail`, where builders invoice vs underpayment |
| `src/lib/email/registration-email-eligibility.test.ts` | Matriks status × key |
| `src/lib/email/send-registration-email.ts` | `sendRegistrationEmailByKey` — load, render, outbound, log |
| `src/lib/email/send-registration-invoice-email.ts` | Wrapper `invoice` + ctx builder |
| `src/lib/email/send-receipt-email.ts` | Wrapper `receipt` |
| `src/lib/email/registration-invoice-blast-eligibility.ts` | Where eligible blast `invoice` |
| `src/lib/email-templates/email-template-catalog.ts` | 11 entri + `triggerDescriptionId` + `isSystemTemplate` |
| `src/lib/email-templates/default-bodies.ts` | Semua key |
| `src/lib/email-templates/email-template-policy.ts` | `REQUIRED_EMAIL_TOKENS` per key baru |
| `src/lib/email-templates/email-template-editor-validation.ts` | Blok wajib per key |
| `src/lib/email-templates/render-lifecycle-email.ts` | `renderReceiptEmail`, `renderRejectedEmail`, … |
| `src/lib/email-templates/render-auth-template-email.ts` | `resolveOtpEmailContent`, `resolveAdminInviteEmailContent` |
| `src/lib/email-templates/load-email-template-preview-vars.ts` | Vars DB untuk key baru |
| `src/lib/actions/admin-registration-invoice-email.ts` | Kirim tunggal + preview/run blast `invoice` |
| `src/lib/actions/admin-registration-lifecycle-email.ts` | `sendLifecycleEmailToRegistration(kind)` |
| `src/lib/actions/admin-club-notification-preferences.ts` | Simpan boolean auto-email |
| `src/lib/forms/club-notification-preferences-schema.ts` | Zod boolean fields |
| `src/components/admin/club-notification-preferences-form.tsx` | Toggle auto-email |
| `src/components/admin/registration-comms-dialog.tsx` | WA + email preview + kirim |
| `src/components/admin/registration-invoice-blast-dialog.tsx` | Blast tagihan pendaftaran |
| `src/components/admin/send-registration-invoice-email-button.tsx` | Tombol manual `invoice` |
| `src/lib/actions/verify-registration.ts` | `emailResult` + pref auto |
| `src/lib/actions/cancel-refund.ts` | `emailResult` + pref auto |
| `src/lib/actions/submit-registration.ts` | `trySendReceiptEmail` |
| `src/lib/auth/auth.ts` | (unchanged path magic link) |
| `src/lib/auth/build-two-factor-plugin-options.ts` | OTP dari DB |
| `src/lib/actions/admin-admin-invitations.ts` | Invite dari DB |
| `CLAUDE.md` | Enum, modul, peta template |

---

## Phase 1 — Schema & preferensi

### Task 1: Prisma enum + notification prefs

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDDHHMMSS_email_template_keys_and_auto_prefs/migration.sql`

- [ ] **Step 1: Extend `EmailTemplateKey` enum**

Di `prisma/schema.prisma`, tambahkan ke enum (urutan bebas; gunakan migration SQL terpisah per nilai jika Postgres production sensitif):

```prisma
enum EmailTemplateKey {
  invoice
  invoice_underpayment
  registration_approved
  receipt
  rejected
  payment_issue
  cancelled
  refunded
  magic_link
  admin_invite
  otp
}
```

- [ ] **Step 2: Extend `ClubNotificationPreferences`**

```prisma
model ClubNotificationPreferences {
  singletonKey              String                   @id @default("default")
  outboundMode              NotificationOutboundMode @default(log_only)
  outboundLabel             String?                  @db.VarChar(120)
  emailAutoOnSubmitReceipt  Boolean                  @default(false)
  emailAutoOnApprove        Boolean                  @default(true)
  emailAutoOnReject         Boolean                  @default(false)
  emailAutoOnPaymentIssue   Boolean                  @default(false)
  emailAutoOnCancel         Boolean                  @default(false)
  emailAutoOnRefund         Boolean                  @default(false)
  updatedAt                 DateTime                 @updatedAt
}
```

- [ ] **Step 3: Migration SQL**

```sql
ALTER TYPE "EmailTemplateKey" ADD VALUE IF NOT EXISTS 'receipt';
ALTER TYPE "EmailTemplateKey" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "EmailTemplateKey" ADD VALUE IF NOT EXISTS 'payment_issue';
ALTER TYPE "EmailTemplateKey" ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE "EmailTemplateKey" ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE "EmailTemplateKey" ADD VALUE IF NOT EXISTS 'admin_invite';
ALTER TYPE "EmailTemplateKey" ADD VALUE IF NOT EXISTS 'otp';

ALTER TABLE "ClubNotificationPreferences"
  ADD COLUMN IF NOT EXISTS "emailAutoOnSubmitReceipt" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailAutoOnApprove" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "emailAutoOnReject" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailAutoOnPaymentIssue" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailAutoOnCancel" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailAutoOnRefund" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 4: Generate client**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm db:migrate:dev --name email_full_integration
pnpm prisma generate
```

Expected: migrasi sukses; tidak ada error enum duplicate di dev.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): perluas EmailTemplateKey dan preferensi auto-email"
```

---

### Task 2: Form + action preferensi notifikasi

**Files:**
- Modify: `src/lib/forms/club-notification-preferences-schema.ts`
- Modify: `src/lib/actions/admin-club-notification-preferences.ts`
- Modify: `src/components/admin/club-notification-preferences-form.tsx`
- Modify: `src/lib/public/load-club-notification-preferences.ts` (select kolom baru)

- [ ] **Step 1: Zod schema**

```typescript
export const clubNotificationPreferencesSaveSchema = z.object({
  outboundMode: z.enum(['off', 'log_only', 'live']),
  outboundLabel: z
    .string()
    .optional()
    .transform(v => (v ?? '').trim())
    .transform(v => (v === '' ? '' : v.slice(0, 120))),
  emailAutoOnSubmitReceipt: z.coerce.boolean().optional().default(false),
  emailAutoOnApprove: z.coerce.boolean().optional().default(true),
  emailAutoOnReject: z.coerce.boolean().optional().default(false),
  emailAutoOnPaymentIssue: z.coerce.boolean().optional().default(false),
  emailAutoOnCancel: z.coerce.boolean().optional().default(false),
  emailAutoOnRefund: z.coerce.boolean().optional().default(false),
})
```

Gunakan hidden input `value="true"` / checkbox pattern yang sudah dipakai form komite lain.

- [ ] **Step 2: Action** — parse boolean dari `FormData` (`=== 'true'`), `guardOwner()`, upsert singleton, `appendClubAuditLog`, pesan error Bahasa Indonesia.

- [ ] **Step 3: UI** — section **Email otomatis** dengan 6 Switch + penjelasan: hanya mengirim lewat Resend jika mode **Live**.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(admin): preferensi auto-email komite"
```

---

## Phase 2 — Katalog & eligibility

### Task 3: Perluas `EMAIL_TEMPLATE_CATALOG` (7 key baru)

**Files:**
- Modify: `src/lib/email-templates/email-template-catalog.ts`
- Modify: `src/lib/email-templates/email-template-catalog.test.ts`
- Modify: `src/lib/email-templates/default-bodies.ts`
- Modify: `src/lib/email-templates/email-template-policy.ts`
- Modify: `src/lib/email-templates/email-template-editor-validation.ts`

- [ ] **Step 1: Tambah tipe katalog**

```typescript
export type EmailTemplateCatalogEntry = {
  // existing fields...
  triggerDescriptionId: string
  isSystemTemplate?: boolean
}
```

- [ ] **Step 2: Entri baru** — salin naskah default dari `WA_TEMPLATE_CATALOG` (`receipt`, `rejected`, `payment_issue`, `cancelled`, `refunded`) ke `defaultBlocks` (paragraph + `footer_disclaimer` bila perlu). `admin_invite`: `cta_button` label `Terima undangan`, token `{invite_url}` `{role_label}`. `otp`: paragraph `Kode OTP Anda: {otp_code}` + disclaimer.

`triggerDescriptionId` contoh:
- `receipt`: "Otomatis setelah submit (jika diaktifkan di Notifikasi)."
- `invoice`: "Manual / blast — tagihan total pendaftaran."
- `rejected`: "Setelah tolak registrasi (dialog atau auto)."

- [ ] **Step 3: Test katalog**

```typescript
it('covers every EmailTemplateKey', () => {
  const enumKeys = Object.values(EmailTemplateKey).filter(v => typeof v === 'string')
  expect(enumKeys.every(k => EMAIL_TEMPLATE_CATALOG[k])).toBe(true)
})
```

Run: `pnpm vitest run src/lib/email-templates/email-template-catalog.test.ts`

- [ ] **Step 4: `default-bodies.ts`** — satu entry per key memakai `serializeStoredBody`.

- [ ] **Step 5: Policy + editor validation** — `reason` wajib untuk `rejected` / `payment_issue`; `otp_code` wajib untuk `otp`; `invite_url` + `cta_button` untuk `admin_invite`.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(email): katalog 11 template dan validasi editor"
```

---

### Task 4: Eligibility helper

**Files:**
- Create: `src/lib/email/registration-email-eligibility.ts`
- Create: `src/lib/email/registration-email-eligibility.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { EmailTemplateKey, RegistrationStatus } from '@prisma/client'
import { canSendRegistrationEmail } from './registration-email-eligibility'

describe('canSendRegistrationEmail', () => {
  it('invoice blocked when unpaid underpayment exists', () => {
    expect(
      canSendRegistrationEmail({
        status: RegistrationStatus.pending_review,
        contactEmail: 'a@b.com',
        hasUnpaidUnderpayment: true,
      }, EmailTemplateKey.invoice),
    ).toBe(false)
  })

  it('registration_approved requires approved status', () => {
    expect(
      canSendRegistrationEmail({
        status: RegistrationStatus.pending_review,
        contactEmail: 'a@b.com',
        hasUnpaidUnderpayment: false,
      }, EmailTemplateKey.registration_approved),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

`pnpm vitest run src/lib/email/registration-email-eligibility.test.ts`

- [ ] **Step 3: Implement**

```typescript
export type RegistrationEmailEligibilityInput = {
  status: RegistrationStatus
  contactEmail: string | null
  hasUnpaidUnderpayment: boolean
  rejectionReason?: string | null
  paymentIssueReason?: string | null
}

const TERMINAL: RegistrationStatus[] = [
  RegistrationStatus.rejected,
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
]

export function canSendRegistrationEmail(
  input: RegistrationEmailEligibilityInput,
  key: EmailTemplateKey,
): boolean {
  if (!input.contactEmail?.trim()) return false
  switch (key) {
    case EmailTemplateKey.invoice:
      return !input.hasUnpaidUnderpayment && !TERMINAL.includes(input.status)
    case EmailTemplateKey.invoice_underpayment:
      return input.hasUnpaidUnderpayment && !TERMINAL.includes(input.status)
    case EmailTemplateKey.registration_approved:
      return input.status === RegistrationStatus.approved
    case EmailTemplateKey.rejected:
      return input.status === RegistrationStatus.rejected && !!input.rejectionReason?.trim()
    case EmailTemplateKey.payment_issue:
      return input.status === RegistrationStatus.payment_issue && !!input.paymentIssueReason?.trim()
    case EmailTemplateKey.cancelled:
      return input.status === RegistrationStatus.cancelled
    case EmailTemplateKey.refunded:
      return input.status === RegistrationStatus.refunded
    case EmailTemplateKey.receipt:
      return !TERMINAL.includes(input.status)
    default:
      return false
  }
}
```

- [ ] **Step 4: `buildRegistrationInvoiceBlastWhere`** — mirror `buildInvoiceBlastRegistrationWhere` tetapi `adjustments: { none: { type: underpayment, status: unpaid } }` AND status filter.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/registration-email-eligibility.ts src/lib/email/registration-email-eligibility.test.ts
git commit -m "feat(email): eligibility registrasi per template key"
```

---

## Phase 3 — Render & send core

### Task 5: `render-lifecycle-email.ts`

**Files:**
- Create: `src/lib/email-templates/render-lifecycle-email.ts`
- Create: `src/lib/email-templates/render-lifecycle-email.test.ts`

- [ ] **Step 1: Test render rejected dengan reason**

```typescript
import { EmailTemplateKey } from '@prisma/client'
import { renderLifecycleEmail } from './render-lifecycle-email'

it('renders rejected with reason token', async () => {
  const { subject, text } = await renderLifecycleEmail(EmailTemplateKey.rejected, null, {
    contact_name: 'Budi',
    event_title: 'Gala',
    reason: 'Bukti tidak jelas',
  })
  expect(subject).toContain('Gala')
  expect(text).toContain('Bukti tidak jelas')
})
```

- [ ] **Step 2: Implement** — pola sama `renderInvoiceTemplateEmail`: load entry, parse blocks, `renderEmailFromBlocks`, fallback default on throw.

Export: `renderReceiptEmail`, `renderRejectedEmail`, `renderPaymentIssueEmail`, `renderCancelledEmail`, `renderRefundedEmail` → thin wrappers `renderLifecycleEmail(key, ...)`.

- [ ] **Step 3: Run tests**

`pnpm vitest run src/lib/email-templates/render-lifecycle-email.test.ts`

- [ ] **Step 4: Commit**

---

### Task 6: `sendRegistrationEmailByKey`

**Files:**
- Create: `src/lib/email/send-registration-email.ts`
- Modify: `src/lib/email/send-invoice-email.ts` (delegasi ke helper atau panggil shared log)
- Create: `src/lib/email/send-registration-invoice-email.ts`
- Create: `src/lib/email/send-receipt-email.ts`

- [ ] **Step 1: Shared type**

```typescript
export type SendRegistrationEmailResult =
  | { ok: true; dryRun?: boolean; skipped?: string }
  | { ok: false; error: string }
```

- [ ] **Step 2: `loadRegistrationEmailContext(registrationId)`** — satu query Prisma dengan tickets, event, bank, adjustments (sama pola `send-invoice-email.ts`).

- [ ] **Step 3: `sendRegistrationEmailByKey(opts)`** — cek `canSendRegistrationEmail`; switch render:
- `invoice` → `renderRegistrationInvoiceEmail`
- `invoice_underpayment` → `renderInvoiceUnderpaymentEmail`
- `registration_approved` → `renderRegistrationApprovedEmail`
- lifecycle keys → `renderLifecycleEmail`
- outbound + `EmailDeliveryLog` (copy dari `send-registration-approved-email.ts`)

- [ ] **Step 4: Refactor `sendInvoiceEmailForRegistration`** menjadi thin wrapper yang memanggil `sendRegistrationEmailByKey` dengan key `invoice_underpayment` (pertahankan signature publik).

- [ ] **Step 5: `sendRegistrationInvoiceEmailForRegistration`** — key `invoice`.

- [ ] **Step 6: `trySendReceiptEmail` pada submit** — baca pref `emailAutoOnSubmitReceipt`.

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(email): sendRegistrationEmailByKey dan receipt/invoice wrappers"
```

---

### Task 7: Selesaikan WIP line items & preview

**Files:**
- Modify: `src/lib/email-templates/load-email-template-preview-vars.ts`
- Modify: `src/lib/email/send-registration-approved-email.ts` (delegasi ke shared atau hapus duplikasi query)
- Verify: `src/lib/email-templates/email-transaction-line-items.ts` (uncommitted)

- [ ] **Step 1:** Pastikan `buildTicketLineItems` dipanggil untuk `invoice`, `invoice_underpayment`, `registration_approved` di jalur `sendRegistrationEmailByKey`.

- [ ] **Step 2:** `load-email-template-preview-vars.ts` — case untuk `receipt`, `rejected`, `payment_issue`, `cancelled`, `refunded` memuat registrasi terbaru + `reason` dari DB.

- [ ] **Step 3:** Run tests

`pnpm vitest run src/lib/email-templates/load-email-template-preview-vars.test.ts src/lib/email-templates/render-email-from-blocks.test.ts`

- [ ] **Step 4: Commit** (include any pending WIP files in repo)

---

## Phase 4 — Actions & blast invoice

### Task 8: Blast + kirim tunggal `invoice`

**Files:**
- Create: `src/lib/email/registration-invoice-blast-eligibility.ts`
- Create: `src/lib/actions/admin-registration-invoice-email.ts`
- Create: `src/components/admin/registration-invoice-blast-dialog.tsx`
- Create: `src/components/admin/send-registration-invoice-email-button.tsx`
- Modify: `src/components/admin/admin-event-registrants-toolbar.tsx`
- Modify: `src/components/admin/invoice-adjustment-panel.tsx` (rename label underpayment button)
- Modify: `src/components/admin/send-invoice-email-button.tsx` (label Indonesia)

- [ ] **Step 1: Server actions** — mirror `admin-invoice-email-blast.ts`:
- `previewRegistrationInvoiceEmailBlast(eventId, opts)`
- `runRegistrationInvoiceEmailBlast(eventId, opts)`
- `sendRegistrationInvoiceEmailToRegistration(eventId, registrationId)` — `guardEvent`, `ActionResult`

- [ ] **Step 2: Dialog blast** — copy struktur `invoice-email-blast-dialog.tsx`; teks: "Blast tagihan pendaftaran".

- [ ] **Step 3: Toolbar** — dua tombol: "Blast kekurangan" (existing) + "Blast tagihan pendaftaran".

- [ ] **Step 4: Tombol di detail** — tampilkan `SendRegistrationInvoiceEmailButton` di `invoice-adjustments-section` atau `identity-section` ketika `!hasUnpaidUnderpayment && contact.email`.

- [ ] **Step 5: Manual test checklist** — pref `log_only` → console log `[email-invoice]` / `[email-registration-invoice]` tanpa Resend.

- [ ] **Step 6: Commit**

---

### Task 9: Hook lifecycle actions

**Files:**
- Modify: `src/lib/actions/verify-registration.ts`
- Modify: `src/lib/actions/cancel-refund.ts`
- Modify: `src/lib/actions/submit-registration.ts`
- Modify: `src/lib/email/send-registration-approved-email.ts`

- [ ] **Step 1: Helper `maybeAutoSendRegistrationEmail`**

```typescript
async function maybeAutoSendRegistrationEmail(
  key: EmailTemplateKey,
  prefEnabled: boolean,
  opts: { registrationId: string; eventId: string; actorAuthUserId: string; actorProfileId: string | null },
): Promise<SendRegistrationEmailResult | null> {
  if (!prefEnabled) return null
  try {
    return await sendRegistrationEmailByKey({ ...opts, templateKey: key })
  } catch {
    return { ok: false, error: 'Gagal mengirim email.' }
  }
}
```

- [ ] **Step 2: `approveRegistration`** — ganti langsung `sendRegistrationApprovedEmailForRegistration` dengan pref `emailAutoOnApprove`; return type `paymentProofEmail` tetap.

- [ ] **Step 3: `rejectRegistration` / `markPaymentIssue`** — return `ActionResult<{ ok: true; email: SendRegistrationEmailResult | null }>`.

- [ ] **Step 4: `cancelRegistration` / `refundRegistration`** — sama dengan pref cancel/refund.

- [ ] **Step 5: `submitRegistration`** — setelah sukses, `trySendReceiptEmail` non-blocking (try/catch, tidak ubah `ok`).

- [ ] **Step 6: Update tests** — `verify-registration.test.ts` mock `sendRegistrationEmailByKey`.

- [ ] **Step 7: Commit**

---

### Task 10: Server action kirim manual dari dialog

**Files:**
- Create: `src/lib/actions/admin-registration-lifecycle-email.ts`

- [ ] **Step 1:**

```typescript
'use server'

const KIND_TO_KEY: Record<RegistrationNotifyKind, EmailTemplateKey | null> = {
  approved: EmailTemplateKey.registration_approved,
  rejected: EmailTemplateKey.rejected,
  payment_issue: EmailTemplateKey.payment_issue,
  cancelled: EmailTemplateKey.cancelled,
  refunded: EmailTemplateKey.refunded,
  underpayment_email_reminder: null,
}

export async function sendRegistrationCommsEmail(
  eventId: string,
  registrationId: string,
  kind: RegistrationNotifyKind,
): Promise<ActionResult<SendRegistrationEmailResult>> {
  // guardEvent, map kind → key, sendRegistrationEmailByKey
}
```

- [ ] **Step 2: Commit**

---

## Phase 5 — UI dialog & indeks template

### Task 11: `RegistrationCommsDialog`

**Files:**
- Create: `src/components/admin/registration-comms-dialog.tsx`
- Modify: `src/components/admin/registration-detail-panels/tab-verification/decision-section.tsx`
- Modify: `src/components/admin/registration-detail-panels/tab-operations/operations-tab-client.tsx`
- Modify: `src/components/admin/registration-actions.tsx`
- Delete or re-export: `src/components/admin/registration-notify-dialog.tsx`

- [ ] **Step 1: Props**

```typescript
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  wa: RegistrationNotifyPayload | null
  emailPreview: { subject: string; textPreview: string } | null
  emailDisabledReason: string | null
  eventId: string
  registrationId: string
  kind: RegistrationNotifyKind
}
```

- [ ] **Step 2: Client** — muat preview email via server action `previewRegistrationCommsEmail` (render tanpa kirim) saat dialog open, atau kirim preview dari parent setelah WA build.

- [ ] **Step 3: Tombol Kirim email** — `sendRegistrationCommsEmail`; `toastCudSuccess` / `toastActionErr`.

- [ ] **Step 4: `underpayment_email_reminder`** — sembunyikan tombol email (hanya WA).

- [ ] **Step 5: Wire semua `openNotify` call sites** — pass `eventId`, `registrationId`, `kind`.

- [ ] **Step 6: Commit**

---

### Task 12: Indeks template admin

**Files:**
- Modify: `src/lib/email-templates/build-email-template-index-rows.ts`
- Modify: `src/components/admin/email-templates/email-templates-table.tsx`
- Modify: `src/app/admin/settings/templates/email/page.tsx`

- [ ] **Step 1:** Tambah `triggerDescription` dan `isSystemTemplate` ke row.

- [ ] **Step 2:** Kolom tabel **Dipakai saat** + Badge **Sistem** untuk `magic_link`, `otp`, `admin_invite`.

- [ ] **Step 3: Commit**

---

## Phase 6 — Auth templates (DB)

### Task 13: `render-auth-template-email.ts`

**Files:**
- Create: `src/lib/email-templates/render-auth-template-email.ts`
- Modify: `src/lib/auth/build-two-factor-plugin-options.ts`
- Modify: `src/lib/actions/admin-admin-invitations.ts`
- Delete: `src/lib/auth/emails/magic-link-email.tsx`, `otp-email.tsx`, `admin-invite-email.tsx` (setelah migrasi)
- Modify: `src/lib/auth/emails/render-emails.test.ts` → pindah ke `render-auth-template-email.test.ts`

- [ ] **Step 1: `resolveOtpEmailContent(otp: string)`**

```typescript
export async function resolveOtpEmailContent(otp: string) {
  const templates = await loadClubEmailTemplates()
  const fromDb = templates[EmailTemplateKey.otp] ?? null
  return renderLifecycleEmail(EmailTemplateKey.otp, fromDb, { otp_code: otp })
}
```

- [ ] **Step 2: `resolveAdminInviteEmailContent(inviteUrl, roleLabel)`** — vars `invite_url`, `role_label`; CTA href = inviteUrl.

- [ ] **Step 3: Wire `buildTwoFactorPluginOptions`**

```typescript
const { subject, text, html } = await resolveOtpEmailContent(otp)
await sendTransactionalEmail({ to: user.email, subject, text, html })
```

- [ ] **Step 4: Wire `createAdminInvitation`** — ganti `renderAdminInviteEmail`.

- [ ] **Step 5: Hapus dead `renderMagicLinkEmail` exports** jika tidak ada import.

- [ ] **Step 6: Tests + commit**

---

## Phase 7 — Dokumentasi & verifikasi

### Task 14: CLAUDE.md + spec status

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-06-05-email-full-integration-design.md` (`status: approved`)

- [ ] **Step 1:** Data model — enum `EmailTemplateKey` lengkap; `ClubNotificationPreferences` boolean.

- [ ] **Step 2:** Key library modules — daftar `send-registration-email.ts`, `registration-email-eligibility.ts`, `render-lifecycle-email.ts`, dll.

- [ ] **Step 3:** UI components — `RegistrationCommsDialog`, blast dialog kedua.

- [ ] **Step 4: Commit**

```bash
git commit -am "docs: integrasi email penuh di CLAUDE.md"
```

---

### Task 15: Verifikasi akhir

- [ ] **Step 1: Lint**

```bash
nvm use && pnpm lint
```

- [ ] **Step 2: Tests**

```bash
pnpm test
```

- [ ] **Step 3: Smoke manual** (checklist)
  - [ ] Edit template `rejected` di admin → preview tampil `reason`
  - [ ] Tolak registrasi → dialog WA + email → Kirim email (log_only)
  - [ ] Approve dengan `emailAutoOnApprove` true → email bukti
  - [ ] Blast tagihan pendaftaran vs kekurangan — hitung eligible berbeda
  - [ ] Magic link + OTP + undangan masih terkirim (staging Resend)

---

## Plan self-review

| Spec requirement | Task |
| ---------------- | ---- |
| 11 enum keys | Task 1, 3 |
| Notification prefs | Task 1–2 |
| `invoice` send + blast | Task 8 |
| Lifecycle email + auto pref | Task 5–6, 9 |
| Dialog WA+email | Task 10–11 |
| OTP + admin_invite DB | Task 13 |
| Line items / preview WIP | Task 7 |
| CLAUDE.md | Task 14 |
| Email tidak gagalkan mutasi | Task 9 (try/catch pattern) |

**Placeholder scan:** tidak ada TBD dalam task di atas.

---

## Eksekusi

Plan disimpan. Pilih salah satu:

1. **Subagent-Driven (disarankan)** — subagent per task, review antar task  
2. **Inline Execution** — jalankan bertahap di sesi ini dengan checkpoint

Mana yang Anda inginkan?
