# Email — member, pendaftaran, template, blast invoice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambah email di direktori member dan pendaftaran, halaman Pengaturan **Template pesan** (tab WA + Email), magic link dari DB, serta blast/kirim tunggal invoice via Resend.

**Architecture:** Migrasi Prisma untuk field email + `ClubEmailTemplate` + `EmailDeliveryLog`; helper `normalizeStoredEmail` dipakai semua jalur tulis; template email mirror pola WA (`applyEmailPlaceholders`, policy token, fallback default); blast memakai query eligible + `ClubNotificationPreferences.outboundMode` sebelum Resend.

**Tech Stack:** Prisma Postgres, Next.js 16 App Router, Zod, Resend, React Email (wrapper magic link saja), Vitest, Better Auth magic-link plugin.

**Spec:** [`docs/superpowers/specs/2026-06-06-email-templates-and-blast-design.md`](../specs/2026-06-06-email-templates-and-blast-design.md)

---

## File map

| File | Tanggung jawab |
| ---- | -------------- |
| `prisma/schema.prisma` | Field email; enum `EmailTemplateKey`; `ClubEmailTemplate`; `EmailDeliveryLog` |
| `src/lib/email/normalize-email.ts` | `normalizeStoredEmail`, `optionalStoredEmail`, `requiredStoredEmail` |
| `src/lib/email/normalize-email.test.ts` | Tes normalisasi + validasi |
| `src/lib/email-templates/email-placeholder.ts` | `applyEmailPlaceholders` (fork regex dari WA) |
| `src/lib/email-templates/email-template-policy.ts` | `REQUIRED_EMAIL_TOKENS`, `validateEmailTemplate` |
| `src/lib/email-templates/email-template-policy.test.ts` | Tes policy |
| `src/lib/email-templates/default-bodies.ts` | Default subject/body per `EmailTemplateKey` |
| `src/lib/email-templates/render-invoice-email.ts` | `renderInvoiceUnderpaymentEmail(db, ctx)` |
| `src/lib/email-templates/render-invoice-email.test.ts` | Tes render + fallback |
| `src/lib/email-templates/load-club-email-templates.ts` | `loadClubEmailTemplates()` |
| `src/lib/email-templates/render-magic-link-email.ts` | `resolveMagicLinkEmailContent(url)` |
| `src/lib/forms/club-email-template-schema.ts` | Zod save form |
| `src/lib/forms/admin-master-member-schema.ts` | Tambah `email` opsional |
| `src/lib/forms/submit-registration-schema.ts` | `holderEmail` opsional; email wajib holder #0 |
| `src/lib/audit/club-audit-actions.ts` | `CLUB_EMAIL_TEMPLATE_SAVED`, `CLUB_EMAIL_TEMPLATE_RESET` |
| `src/lib/actions/admin-club-email-templates.ts` | save/reset Owner |
| `src/lib/email/invoice-email-eligibility.ts` | Query eligible + counts (pure + prisma) |
| `src/lib/email/invoice-email-eligibility.test.ts` | Tes filter (mock atau fixture) |
| `src/lib/email/send-invoice-email.ts` | Satu pengiriman + log + outbound mode |
| `src/lib/actions/admin-invoice-email-blast.ts` | preview, run blast, single send |
| `src/lib/actions/admin-registration-contact.ts` | Update `contactEmail` / holder emails |
| `src/lib/actions/lookup-member-for-registration.ts` | Return `email` pada valid |
| `src/lib/actions/submit-registration.ts` | Persist `contactEmail`, `holderEmail` |
| `src/lib/actions/admin-master-members.ts` | CRUD + CSV email |
| `src/lib/members/*` | CSV column `email`, export, query VM |
| `src/components/admin/member-form-dialog.tsx` | Input email |
| `src/components/public/registration-form/holder-card.tsx` | Email field (wajib index 0) |
| `src/components/public/registration-form/use-holder-member-validation.ts` | Pre-fill email dari lookup |
| `src/components/admin/club-email-templates-panel.tsx` | Tab Email UI |
| `src/components/admin/settings-templates-tabs.tsx` | Client tabs WA \| Email |
| `src/app/admin/settings/templates/page.tsx` | RSC gabungan |
| `src/app/admin/settings/templates/layout.tsx` | Guard Owner (pindah dari whatsapp-templates) |
| `src/app/admin/settings/whatsapp-templates/page.tsx` | Redirect ke `?tab=wa` |
| `src/components/admin/invoice-email-blast-dialog.tsx` | Dialog blast |
| `src/components/admin/admin-event-registrants-toolbar.tsx` | Tombol blast |
| `src/components/admin/registration-detail-panels/tab-verification/communication-section.tsx` | Tombol kirim email |
| `src/lib/auth/auth.ts` | Magic link pakai `resolveMagicLinkEmailContent` |
| `next.config.ts` | Redirect `whatsapp-templates` → `templates` |
| `src/components/admin/committee-settings-subnav.tsx` | Label + href templates |
| `CLAUDE.md` | Route, model, modul baru |

---

### Task 1: Prisma schema + migrasi

**Files:**
- Modify: `prisma/schema.prisma`

Tambahkan setelah enum `WaTemplateKey`:

```prisma
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

Pada model existing:

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
```

- [ ] **Step 1:** Sisipkan blok di atas ke `schema.prisma`.

- [ ] **Step 2:** Migrasi

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm prisma migrate dev --name email_member_templates_blast
```

Expected: migrasi sukses, client ter-generate.

- [ ] **Step 3:** Commit

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): email fields, club email templates, delivery log"
```

---

### Task 2: Normalisasi email (TDD)

**Files:**
- Create: `src/lib/email/normalize-email.ts`
- Create: `src/lib/email/normalize-email.test.ts`

```typescript
// src/lib/email/normalize-email.ts
import { z } from 'zod'

const emailSchema = z.string().trim().email('Format email tidak valid.')

/** Lowercase + trim untuk penyimpanan. */
export function normalizeStoredEmail(raw: string): string {
  const parsed = emailSchema.parse(raw)
  return parsed.toLowerCase()
}

export function optionalStoredEmail(raw: string | undefined | null): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  return normalizeStoredEmail(t)
}

export function requiredStoredEmail(raw: string): string {
  return normalizeStoredEmail(raw)
}
```

```typescript
// src/lib/email/normalize-email.test.ts
import { describe, expect, it } from 'vitest'
import { normalizeStoredEmail, optionalStoredEmail } from './normalize-email'

describe('normalizeStoredEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeStoredEmail('  Foo@Bar.COM ')).toBe('foo@bar.com')
  })
  it('rejects invalid', () => {
    expect(() => normalizeStoredEmail('not-an-email')).toThrow()
  })
})

describe('optionalStoredEmail', () => {
  it('returns null for empty', () => {
    expect(optionalStoredEmail('')).toBeNull()
  })
})
```

- [ ] **Step 1:** Tulis test file.
- [ ] **Step 2:** `pnpm vitest run src/lib/email/normalize-email.test.ts` → FAIL.
- [ ] **Step 3:** Implement `normalize-email.ts`.
- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** Commit `feat: email normalize helper`.

---

### Task 3: Direktori member — schema, CRUD, CSV, daftar

**Files:**
- Modify: `src/lib/forms/admin-master-member-schema.ts`
- Modify: `src/lib/actions/admin-master-members.ts`
- Modify: `src/components/admin/member-form-dialog.tsx`
- Modify: `src/lib/members/master-member-csv-constants.ts`
- Modify: `src/lib/members/prepare-master-member-csv-row.ts`
- Modify: `src/lib/members/parse-master-member-csv-text.ts` (jika perlu validasi kolom)
- Modify: `src/lib/members/query-admin-master-members.ts`
- Modify: `src/lib/members/build-master-members-export-csv.ts`
- Modify: `src/lib/members/master-member-csv-template.ts`
- Test: perluas `src/lib/members/*test*` bila ada

**Schema Zod** — tambah ke create/update:

```typescript
email: z
  .union([z.string().trim().email('Format email tidak valid.'), z.literal('')])
  .optional()
  .transform(v => (v === '' || v === undefined ? undefined : v)),
```

Pada `createMasterMember` / `updateMasterMember`:

```typescript
email: optionalStoredEmail(z.data.email ?? null),
```

**CSV:** tambah `'email'` ke `MASTER_MEMBER_CSV_COLUMNS`; di `prepareMasterMemberCsvRow` jika sel terisi → validasi format (reject baris jika invalid); patch `email?: string`.

**UI `member-form-dialog`:** `<Input type="email" />` label "Email (opsional)".

**Daftar admin:** kolom email di tabel (truncate) — opsional v1 jika padat.

- [ ] Implement + tes CSV row dengan email invalid → reject.
- [ ] Commit `feat(admin): optional email on master member directory`.

---

### Task 4: Form pendaftaran publik + submit

**Files:**
- Modify: `src/lib/forms/submit-registration-schema.ts`
- Modify: `src/lib/forms/submit-registration-schema.test.ts`
- Modify: `src/lib/actions/submit-registration.ts`
- Modify: `src/lib/actions/lookup-member-for-registration.ts`
- Modify: `src/components/public/registration-form/holder-card.tsx`
- Modify: `src/components/public/registration-form/use-holder-member-validation.ts`
- Modify: `src/components/public/registration-form/registration-form.tsx` (defaultValues)

**Schema holder:**

```typescript
const holderEmailOptional = z
  .union([z.string().trim().email('Format email tidak valid.'), z.literal('')])
  .optional()

export const holderSchema = z
  .object({
    holderName: z.string().trim().min(1, 'Nama pemegang tiket wajib diisi'),
    holderWhatsapp: whatsappPhoneSchema,
    holderEmail: holderEmailOptional,
    // ...existing
  })
  .superRefine((data, ctx) => {
    // existing regional check...
  })
```

Tambah refine pada **array level** di `submitRegistrationSchema`:

```typescript
.superRefine((data, ctx) => {
  const firstEmail = (data.holders[0]?.holderEmail ?? '').trim()
  if (!firstEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Email kontak wajib diisi',
      path: ['holders', 0, 'holderEmail'],
    })
  }
})
```

**`submit-registration.ts`** dalam `create` data:

```typescript
const contactEmail = requiredStoredEmail(input.holders[0]!.holderEmail!.trim())
// ...
contactEmail,
holders: {
  create: holdersForProcessing.map((h, i) => ({
    // ...
    holderEmail: optionalStoredEmail(h.holderEmail),
  })),
},
```

**Lookup** — select + return:

```typescript
select: { id: true, fullName: true, whatsapp: true, email: true }
// ...
return { status: 'valid', fullName, whatsapp, email: member.email }
```

**`use-holder-member-validation`:** extend `HolderValidationResult` valid branch dengan `email: string | null`.

**`holder-card.tsx`:** field Email di bawah WhatsApp; `isPrimary` → label "Email kontak" + required; non-primary → "Email (opsional)". Saat valid member lookup, `form.setValue(`holders.${index}.holderEmail`, result.email ?? '')`.

- [ ] Test: submit schema tanpa email holder 0 → fail.
- [ ] Commit `feat(public): require contact email on registration`.

---

### Task 5: Admin — edit email registrasi

**Files:**
- Create: `src/lib/forms/admin-registration-contact-schema.ts`
- Create: `src/lib/actions/admin-registration-contact.ts`
- Modify: `src/components/admin/registration-detail-panels/tab-summary/identity-section.tsx` (tampilkan email)
- Modify: `src/components/admin/registration-detail-panels/shared/registration-detail-types.ts` (+ loader page)
- Create or modify: `src/components/admin/registration-contact-email-form.tsx` (client, RHF kecil)

**Action:**

```typescript
'use server'
// guardEvent(eventId)
// payload: { registrationId, contactEmail, holders: { id, holderEmail? }[] }
// contactEmail: requiredStoredEmail jika non-empty string required; allow null only for legacy patch? 
// Spec: admin can fill legacy — use requiredStoredEmail when operator submits non-empty; empty string → rootError 'Email kontak wajib.' for new edits OR allow setting — spec says legacy can be filled: use requiredStoredEmail(trimmed) when saving
```

Praktis: admin form selalu wajib isi email kontak saat menyimpan (memaksa melengkapi legacy).

- [ ] Wire ke tab Ringkasan atau Operasi.
- [ ] Commit `feat(admin): edit registration contact and holder emails`.

---

### Task 6: Email template utilities + policy (TDD)

**Files:**
- Create: `src/lib/email-templates/email-placeholder.ts`
- Create: `src/lib/email-templates/email-template-policy.ts`
- Create: `src/lib/email-templates/email-template-policy.test.ts`
- Create: `src/lib/email-templates/default-bodies.ts`

Copy pola dari `wa-placeholder.ts` / `wa-template-policy.ts`.

`REQUIRED_EMAIL_TOKENS`:

```typescript
export const REQUIRED_EMAIL_TOKENS: Record<EmailTemplateKey, readonly string[]> = {
  invoice_underpayment: [
    'contact_name',
    'event_title',
    'adjustment_amount_idr',
    'bank_name',
    'account_number',
    'account_name',
  ],
  magic_link: ['magic_link_url'],
}
```

`validateEmailTemplate(key, subject, body)` — subject `.trim().min(1)`, body `.trim().min(1)`, token wajib.

Defaults (Indonesia) — invoice subject contoh: `Tagihan kekurangan — {event_title}`; body mirror `templateUnderpaymentInvoice` baris teks tanpa markdown WA.

- [ ] Tests policy missing token → error string.
- [ ] Commit `feat: email template placeholder and policy`.

---

### Task 7: Render invoice + load templates

**Files:**
- Create: `src/lib/email-templates/render-invoice-email.ts`
- Create: `src/lib/email-templates/render-invoice-email.test.ts`
- Create: `src/lib/email-templates/load-club-email-templates.ts`

```typescript
export type InvoiceEmailCtx = {
  contactName: string
  eventTitle: string
  adjustmentAmountIdr: number
  bankName: string
  accountNumber: string
  accountName: string
  registrationId?: string
}

export function renderInvoiceUnderpaymentEmail(
  fromDb: { subject: string; body: string } | null,
  ctx: InvoiceEmailCtx,
): { subject: string; text: string } {
  // safeApply subject + body; fallback default-bodies + hardcoded functions
}
```

Gunakan `formatWaIdr` atau alias `formatIdrPlain` untuk `{adjustment_amount_idr}`.

- [ ] Test fallback bila DB null.
- [ ] Commit `feat: render invoice underpayment email from db`.

---

### Task 8: Server actions — simpan template email (Owner)

**Files:**
- Create: `src/lib/forms/club-email-template-schema.ts`
- Create: `src/lib/actions/admin-club-email-templates.ts`
- Modify: `src/lib/audit/club-audit-actions.ts`

Mirror `admin-club-wa-templates.ts`:

- `saveClubEmailTemplate` — fields `key`, `subject`, `body`
- `resetClubEmailTemplate` — reset ke `default-bodies.ts`
- `revalidatePath('/admin/settings/templates')`
- Audit: `club.email_template.saved` / `club.email_template.reset`

- [ ] Commit `feat(admin): save and reset club email templates`.

---

### Task 9: Halaman Template pesan (tab WA + Email)

**Files:**
- Create: `src/app/admin/settings/templates/layout.tsx` (copy guard dari `whatsapp-templates/layout.tsx`)
- Create: `src/app/admin/settings/templates/page.tsx`
- Create: `src/components/admin/settings-templates-tabs.tsx`
- Create: `src/components/admin/club-email-templates-panel.tsx`
- Modify: `src/app/admin/settings/whatsapp-templates/page.tsx` → redirect
- Modify: `src/lib/actions/admin-club-wa-templates.ts` — `revalidatePath('/admin/settings/templates')`
- Modify: `src/components/admin/committee-settings-subnav.tsx`
- Modify: `src/app/admin/settings/page.tsx` (kartu link)
- Modify: `next.config.ts`

**Redirect `next.config.ts`:**

```typescript
{
  source: '/admin/settings/whatsapp-templates',
  destination: '/admin/settings/templates?tab=wa',
  permanent: true,
},
```

**`templates/page.tsx`:** load WA rows + `loadClubEmailTemplates()`; render `<SettingsTemplatesTabs waInitial={...} emailInitial={...} />`.

**`club-email-templates-panel.tsx`:** dua kartu (subject Input + body Textarea), daftar token wajib, save/reset actions, preview statis.

- [ ] Manual: Owner buka `/admin/settings/templates?tab=email`.
- [ ] Commit `feat(admin): unified templates settings page with email tab`.

---

### Task 10: Magic link dari template DB

**Files:**
- Create: `src/lib/email-templates/render-magic-link-email.ts`
- Modify: `src/lib/auth/auth.ts`
- Modify: `src/lib/auth/emails/magic-link-email.tsx` (opsional: terima `introLines: string[]`)

```typescript
export async function resolveMagicLinkEmailContent(url: string): Promise<{
  subject: string
  text: string
  introText: string
}> {
  const branding = await getClubBranding() // or load club name only
  const rows = await loadClubEmailTemplates()
  const tpl = rows.magic_link
  // render with { magic_link_url: url, club_name_nav: branding.clubNameNav }
  // fallback: subject/text hardcoded sekarang
}
```

`auth.ts` `sendMagicLink`:

```typescript
const { subject, text, introText } = await resolveMagicLinkEmailContent(url)
const html = await renderMagicLinkEmail(url, introText)
await sendTransactionalEmail({ to: email, subject, text, html })
```

- [ ] Test unit `resolveMagicLinkEmailContent` dengan mock prisma.
- [ ] Commit `feat(auth): magic link subject/body from club email template`.

---

### Task 11: Eligibility query + kirim invoice (core)

**Files:**
- Create: `src/lib/email/invoice-email-eligibility.ts`
- Create: `src/lib/email/invoice-email-eligibility.test.ts`
- Create: `src/lib/email/send-invoice-email.ts`
- Modify: `src/lib/public/load-club-notification-preferences.ts` (sudah ada — pakai di send)

**`listInvoiceEmailBlastCandidates(eventId, opts)`** returns:

```typescript
type BlastCandidate = {
  registrationId: string
  contactEmail: string
  contactName: string
  adjustmentAmountIdr: number
  // bank fields from event include
}
```

Filter:

- `contactEmail: { not: null }`
- `status: { notIn: [rejected, cancelled, refunded] }`
- adjustments: some `underpayment` + `unpaid` — pick latest amount per registration
- `respectListTab`: merge `registrationListWhere(tab, q)` dari `event-registrants-list-url.ts`

**`sendInvoiceEmailToRegistration`:**

1. Load registration + event bank + unpaid underpayment + prefs
2. `off` → throw / return error
3. `log_only` → `console.log('[email-invoice]', { registrationId, to })` return `{ sent: true, dryRun: true }`
4. `live` → require `isTransactionalEmailConfigured()`; render; `sendTransactionalEmail`; `prisma.emailDeliveryLog.create`

**Files actions:**
- Create: `src/lib/actions/admin-invoice-email-blast.ts`

```typescript
export async function previewInvoiceEmailBlast(eventId: string, opts: { respectListTab?: boolean; tab?: ...; q?: string })
export async function runInvoiceEmailBlast(eventId: string, opts: ...)
export async function sendInvoiceEmailToRegistration(eventId: string, registrationId: string)
```

Throttle dalam `runInvoiceEmailBlast`: `for (const c of candidates) { await send...; await sleep(200) }`

- [ ] Test eligibility skips no email.
- [ ] Test `log_only` does not call `sendTransactionalEmail` (vi.mock).
- [ ] Commit `feat: invoice email send and blast eligibility`.

---

### Task 12: UI blast + komunikasi

**Files:**
- Create: `src/components/admin/invoice-email-blast-dialog.tsx`
- Modify: `src/components/admin/admin-event-registrants-toolbar.tsx`
- Modify: `src/app/admin/events/[eventId]/registrants/page.tsx` (pass props jika perlu)
- Modify: `src/components/admin/registration-detail-panels/tab-verification/communication-section.tsx`

**Dialog flow:**

1. Mount → panggil `previewInvoiceEmailBlast` (transition / useEffect)
2. Tampilkan counts + checkbox "Batasi ke filter status tab saat ini"
3. Konfirmasi → `runInvoiceEmailBlast` → toast `toastCudSuccess` / `toastActionErr`

**Toolbar:** `<InvoiceEmailBlastDialog eventId={...} tab={tab} searchQuery={q} />`

**Communication section:** untuk tiap unpaid adjustment (atau satu tombol), jika `registration.contactEmail` → Button "Kirim invoice via email" → `sendInvoiceEmailToRegistration`.

- [ ] Commit `feat(admin): invoice email blast dialog and single send button`.

---

### Task 13: Dokumentasi + regression

**Files:**
- Modify: `CLAUDE.md` — Route layout (`/admin/settings/templates`), Data model (email fields, `ClubEmailTemplate`, `EmailDeliveryLog`), Key library modules

- [ ] `pnpm vitest run` (subset email tests)
- [ ] `pnpm lint`
- [ ] Commit `docs: CLAUDE.md email templates and blast`

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| MasterMember.email optional | 3 |
| contactEmail + holderEmail | 1, 4, 5 |
| Public required email | 4 |
| Legacy null OK | 1 (nullable), 5 (admin fill) |
| Pre-fill lookup | 4 |
| Templates unified route + redirect | 9 |
| Email templates invoice + magic_link | 6–10 |
| Plain subject + body placeholders | 6–7 |
| Blast per event + filter tab | 11–12 |
| Single send detail | 12 |
| outboundMode off/log/live | 11 |
| EmailDeliveryLog on live | 11 |
| Owner template / verifier blast | 8, 11 |
| OTP stays hardcoded | (no task — out of scope) |
| CLAUDE.md | 13 |

## Risks (implementer notes)

- **Resend limits:** tampilkan count di preview; jangan blast >500 tanpa konfirmasi eksplisit di UI.
- **Primary-only mode:** pastikan `contactEmail` selalu dari holder index 0 meski `ticketQty > 1`.
- **Clone holders:** jika server mengkloning holder data untuk primary-only, email kontak hanya di holder 0 — jangan duplikasi ke holderEmail slot 2+ kecuali user isi.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-email-templates-and-blast.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — satu subagent per task, review antar task  
2. **Inline Execution** — jalankan task berurutan di sesi ini dengan checkpoint

Which approach do you want?
