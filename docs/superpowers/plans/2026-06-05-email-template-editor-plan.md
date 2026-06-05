# Editor template email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti editor template email plain textarea dengan editor blok + Tiptap per paragraf, render HTML via React Email, indeks/edit terpisah seperti WA, dan migrasi body plain text lama ke JSON `{"v":1,"blocks":[...]}`.

**Architecture:** Katalog `email-template-catalog.ts` menjadi sumber default blok + token; `body` DB menyimpan JSON v1; `email-doc-serializer` mengubah Tiptap JSON → plain text + React nodes; `render-email-from-blocks.ts` merender HTML Resend; runtime invoice dan magic link memakai pipeline yang sama; UI client mirror `WaTemplateEditForm`.

**Tech Stack:** Next.js 16 App Router, Prisma, Tiptap 3, `react-email` + `render`, Zod, Vitest, Resend, Better Auth magic-link.

**Spec:** [`docs/superpowers/specs/2026-06-05-email-template-editor-design.md`](../specs/2026-06-05-email-template-editor-design.md)

---

## File map

| File | Tanggung jawab |
| ---- | -------------- |
| `src/lib/email-templates/email-block-types.ts` | `EmailBlock`, `StoredEmailTemplateBody`, type guards |
| `src/lib/email-templates/email-template-catalog.ts` | Katalog 2 key, `defaultBlocks`, `tokenMeta`, helpers |
| `src/lib/email-templates/email-template-catalog.test.ts` | Urutan key, default blok valid |
| `src/lib/email-templates/migrate-plain-email-body.ts` | Plain `body` → `EmailBlock[]` |
| `src/lib/email-templates/migrate-plain-email-body.test.ts` | Tes migrasi dari `CLUB_EMAIL_DEFAULT_BODIES` legacy |
| `src/lib/email-templates/parse-stored-email-body.ts` | Parse JSON v1 atau migrate |
| `src/lib/email-templates/parse-stored-email-body.test.ts` | Round-trip + invalid |
| `src/lib/email-templates/email-placeholder-extension.ts` | Tiptap atom `{token}` |
| `src/lib/email-templates/email-doc-serializer.ts` | `plainTextToEmailDoc`, `emailDocToPlainText`, `collectTokensFromDoc` |
| `src/lib/email-templates/email-doc-serializer.test.ts` | Bold, placeholder, list |
| `src/lib/email-templates/email-template-editor-validation.ts` | `analyzeEmailTemplateBlocks` |
| `src/lib/email-templates/email-template-editor-validation.test.ts` | missing/invalid tokens |
| `src/lib/email-templates/email-template-policy.ts` | `validateEmailTemplateBlocks` (perluas) |
| `src/lib/email-templates/email-template-policy.test.ts` | Perluas untuk blok |
| `src/lib/email-templates/emails/club-email-layout.tsx` | Wrapper React Email |
| `src/lib/email-templates/emails/club-email-blocks.tsx` | Mapper blok → JSX |
| `src/lib/email-templates/render-email-from-blocks.ts` | `renderEmailFromBlocks`, `sampleVarsFromCatalog` |
| `src/lib/email-templates/render-email-from-blocks.test.ts` | Snapshot substring HTML |
| `src/lib/email-templates/default-bodies.ts` | Re-export subject + serialized default body JSON dari katalog |
| `src/lib/email-templates/load-club-email-templates.ts` | Return `{ subject, blocks }` parsed |
| `src/lib/email-templates/render-invoice-email.ts` | Pakai `renderEmailFromBlocks` |
| `src/lib/email-templates/render-magic-link-email.ts` | Pakai blok; hapus `introText` hack |
| `src/lib/email/send-invoice-email.ts` | Kirim `html` dari render (bukan pre-wrap) |
| `src/lib/auth/auth.ts` | Magic link: `html`+`text` dari `renderEmailFromBlocks` |
| `src/lib/forms/club-email-template-schema.ts` | Validasi JSON blocks |
| `src/lib/actions/admin-club-email-templates.ts` | save/reset + `previewClubEmailTemplate` |
| `src/components/ui/email-paragraph-editor.tsx` | Tiptap toolbar + placeholder |
| `src/components/admin/email-templates/email-templates-index-header.tsx` | Judul indeks |
| `src/components/admin/email-templates/email-templates-table.tsx` | Tabel 2 baris |
| `src/components/admin/email-templates/email-template-edit-form.tsx` | Editor blok + pratinjau |
| `src/components/admin/email-templates/email-template-preview-panel.tsx` | iframe/HTML preview |
| `src/app/admin/settings/templates/email/page.tsx` | Indeks (ganti panel inline) |
| `src/app/admin/settings/templates/email/[key]/edit/page.tsx` | RSC edit |
| `src/components/admin/club-email-templates-panel.tsx` | **Hapus** setelah migrasi UI |
| `CLAUDE.md` | Route + modul baru |

---

### Task 1: Tipe blok + katalog

**Files:**
- Create: `src/lib/email-templates/email-block-types.ts`
- Create: `src/lib/email-templates/email-template-catalog.ts`
- Create: `src/lib/email-templates/email-template-catalog.test.ts`
- Modify: `src/lib/email-templates/default-bodies.ts`

- [ ] **Step 1: Write failing catalog test**

```ts
// email-template-catalog.test.ts
import { EmailTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { EMAIL_TEMPLATE_KEYS_ORDERED, getEmailTemplateEntry } from './email-template-catalog'

describe('email-template-catalog', () => {
  it('orders invoice then magic_link', () => {
    expect(EMAIL_TEMPLATE_KEYS_ORDERED).toEqual([
      EmailTemplateKey.invoice_underpayment,
      EmailTemplateKey.magic_link,
    ])
  })

  it('invoice default has bank_details block', () => {
    const e = getEmailTemplateEntry(EmailTemplateKey.invoice_underpayment)
    expect(e.defaultBlocks.some(b => b.type === 'bank_details')).toBe(true)
    expect(e.defaultBlocks.filter(b => b.type === 'paragraph').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/email-templates/email-template-catalog.test.ts
```

- [ ] **Step 3: Implement types + catalog**

`email-block-types.ts` — minimal shapes:

```ts
import type { JSONContent } from '@tiptap/core'

export type StoredEmailTemplateBody = { v: 1; blocks: EmailBlock[] }

export type EmailBlock =
  | { type: 'branding_header'; id: string }
  | { type: 'paragraph'; id: string; doc: JSONContent }
  | { type: 'invoice_summary'; id: string }
  | { type: 'bank_details'; id: string }
  | { type: 'cta_button'; id: string; label: string }
  | { type: 'footer_disclaimer'; id: string; text: string }

export function newBlockId(): string {
  return crypto.randomUUID()
}
```

`email-template-catalog.ts` — bangun `defaultBlocks` untuk invoice dari paragraf hasil `plainTextToEmailDoc` (Task 3 akan export; sementara inline doc minimal `{ type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text:'...' }]}]}` ) atau panggil helper setelah Task 3; **urutan implementasi:** Task 3 serializer dulu jika ingin TDD ketat — di plan ini Task 1 boleh pakai doc JSON statis yang disalin dari output `plainTextToEmailDoc` setelah Task 3, atau implement Task 3 sebelum finalize catalog defaults).

**Invoice default order:** `branding_header` → `paragraph`(salam) → `invoice_summary` → `bank_details` → `paragraph`(instruksi) → optional skip `footer_disclaimer`.

**Magic link default order:** `branding_header` → `paragraph`(intro) → `cta_button` → `footer_disclaimer`.

`default-bodies.ts` — ubah menjadi:

```ts
import { serializeStoredBody } from './parse-stored-email-body' // Task 2
import { EMAIL_TEMPLATE_CATALOG } from './email-template-catalog'

export const CLUB_EMAIL_DEFAULT_BODIES = Object.fromEntries(
  (Object.keys(EMAIL_TEMPLATE_CATALOG) as EmailTemplateKey[]).map(key => {
    const e = EMAIL_TEMPLATE_CATALOG[key]
    return [key, { subject: e.defaultSubject, body: serializeStoredBody({ v: 1, blocks: e.defaultBlocks }) }]
  }),
) as Record<EmailTemplateKey, { subject: string; body: string }>
```

- [ ] **Step 4: Run test — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-templates/email-block-types.ts src/lib/email-templates/email-template-catalog.ts src/lib/email-templates/email-template-catalog.test.ts src/lib/email-templates/default-bodies.ts
git commit -m "feat(email-templates): add block types and catalog defaults"
```

---

### Task 2: Parse + migrasi plain text

**Files:**
- Create: `src/lib/email-templates/parse-stored-email-body.ts`
- Create: `src/lib/email-templates/migrate-plain-email-body.ts`
- Create: `src/lib/email-templates/migrate-plain-email-body.test.ts`
- Create: `src/lib/email-templates/parse-stored-email-body.test.ts`

- [ ] **Step 1: Failing migrasi test**

```ts
import { EmailTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { CLUB_EMAIL_LEGACY_PLAIN } from './migrate-plain-email-body.test-fixture' // atau inline string dari default lama
import { migratePlainBodyToBlocks } from './migrate-plain-email-body'

describe('migratePlainBodyToBlocks', () => {
  it('splits invoice legacy body into paragraphs around system blocks', () => {
    const blocks = migratePlainBodyToBlocks(EmailTemplateKey.invoice_underpayment, LEGACY_INVOICE_BODY)
    expect(blocks.some(b => b.type === 'bank_details')).toBe(true)
    expect(blocks.filter(b => b.type === 'paragraph').length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

`parse-stored-email-body.ts`:

```ts
export function serializeStoredBody(body: StoredEmailTemplateBody): string {
  return JSON.stringify(body)
}

export function parseStoredEmailBody(
  key: EmailTemplateKey,
  raw: string,
): { subject: string; blocks: EmailBlock[] } | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null && (parsed as StoredEmailTemplateBody).v === 1) {
      return { blocks: (parsed as StoredEmailTemplateBody).blocks }
    }
  } catch { /* fall through */ }
  return { blocks: migratePlainBodyToBlocks(key, raw) }
}
```

`migrate-plain-email-body.ts` — split `\n\n`, merge baris menjadi paragraf; sisipkan blok sistem dari `getEmailTemplateEntry(key).defaultBlocks` dengan mengganti hanya `paragraph` docs dari teks migrasi.

- [ ] **Step 4: Run tests — PASS**

```bash
pnpm vitest run src/lib/email-templates/migrate-plain-email-body.test.ts src/lib/email-templates/parse-stored-email-body.test.ts
```

- [ ] **Step 5: Commit**

---

### Task 3: Tiptap placeholder + doc serializer

**Files:**
- Create: `src/lib/email-templates/email-placeholder-extension.ts`
- Create: `src/lib/email-templates/email-doc-serializer.ts`
- Create: `src/lib/email-templates/email-doc-serializer.test.ts`

- [ ] **Step 1: Failing serializer test**

```ts
import { describe, expect, it } from 'vitest'
import { emailDocToPlainText, plainTextToEmailDoc, collectTokensFromDoc } from './email-doc-serializer'

describe('email-doc-serializer', () => {
  it('round-trips placeholder chip', () => {
    const doc = plainTextToEmailDoc('Halo {contact_name}')
    expect(collectTokensFromDoc(doc)).toContain('contact_name')
    expect(emailDocToPlainText(doc, { contact_name: 'Budi' })).toBe('Halo Budi')
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

Fork `wa-placeholder-extension.ts` → `emailPlaceholder` node + `insertEmailPlaceholder`.

`plainTextToEmailDoc`: scan `EMAIL_PLACEHOLDER_TOKEN` sama seperti `wa-markdown-serializer` inline parser.

`emailDocToPlainText`: walk doc, apply vars, lists → lines dengan `- ` / `1. `.

`collectTokensFromDoc`: gather `emailPlaceholder` attrs + text regex fallback.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Update catalog defaults** — generate paragraph docs via `plainTextToEmailDoc` dari teks legacy di spec (hapus duplikasi JSON statis Task 1).

- [ ] **Step 6: Commit**

---

### Task 4: Validasi blok + policy

**Files:**
- Create: `src/lib/email-templates/email-template-editor-validation.ts`
- Create: `src/lib/email-templates/email-template-editor-validation.test.ts`
- Modify: `src/lib/email-templates/email-template-policy.ts`
- Modify: `src/lib/email-templates/email-template-policy.test.ts`

- [ ] **Step 1: Failing policy test untuk blok**

```ts
it('invoice requires contact_name in subject or paragraph when not only in system blocks', () => {
  const err = validateEmailTemplateBlocks(EmailTemplateKey.invoice_underpayment, 'Tagihan', minimalBlocksMissingContactName)
  expect(err).toMatch(/contact_name/)
})
```

**Aturan token agregat:**
- Kumpulkan token dari: `subject`, tiap `paragraph.doc`, plus token **implicit** dari blok sistem: `invoice_summary` → `event_title`, `adjustment_amount_idr`; `bank_details` → `bank_name`, `account_number`, `account_name`.
- Magic link: `magic_link_url` tidak perlu di doc; cukup subjek non-kosong + ≥1 paragraf; CTA render inject URL.

- [ ] **Step 2–4: Implement `analyzeEmailTemplateBlocks` + `validateEmailTemplateBlocks` — PASS tests**

- [ ] **Step 5: Commit**

---

### Task 5: React Email render

**Files:**
- Create: `src/lib/email-templates/emails/club-email-layout.tsx`
- Create: `src/lib/email-templates/emails/club-email-blocks.tsx`
- Create: `src/lib/email-templates/render-email-from-blocks.ts`
- Create: `src/lib/email-templates/render-email-from-blocks.test.ts`

- [ ] **Step 1: Failing render test**

```ts
import { describe, expect, it } from 'vitest'
import { EmailTemplateKey } from '@prisma/client'
import { getEmailTemplateEntry } from './email-template-catalog'
import { renderEmailFromBlocks } from './render-email-from-blocks'

describe('renderEmailFromBlocks', () => {
  it('invoice html contains sample bank name', async () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice_underpayment)
    const { html, text } = await renderEmailFromBlocks({
      key: EmailTemplateKey.invoice_underpayment,
      subject: entry.defaultSubject,
      blocks: entry.defaultBlocks,
      vars: sampleVarsFromCatalog(entry),
    })
    expect(html).toContain('BCA')
    expect(text).toContain('Budi')
  })
})
```

- [ ] **Step 2: Implement**

`club-email-layout.tsx` — mirror gaya `magic-link-email.tsx` (Container 480px, bg `#f9fafb`).

`club-email-blocks.tsx` — `renderBlocks(blocks, vars)` switch per `type`; paragraph pakai `emailDocToReactNodes` → `<Text>`, `<Link>`.

`renderEmailFromBlocks` — `applyEmailPlaceholders` pada subject; `render()` dari `react-email`; return `{ subject, text, html }`.

`sampleVarsFromCatalog(entry)` — map `tokenMeta[].sampleValue`.

- [ ] **Step 3: Run test — PASS**

- [ ] **Step 4: Commit**

---

### Task 6: Runtime invoice + magic link

**Files:**
- Modify: `src/lib/email-templates/load-club-email-templates.ts`
- Modify: `src/lib/email-templates/render-invoice-email.ts`
- Modify: `src/lib/email-templates/render-magic-link-email.ts`
- Modify: `src/lib/email/send-invoice-email.ts`
- Modify: `src/lib/auth/auth.ts`
- Modify: `src/lib/auth/emails/render-emails.test.ts` (jika perlu adjust magic link test)

- [ ] **Step 1: Update load**

```ts
export type ClubEmailTemplateRow = { subject: string; blocks: EmailBlock[] }

// findMany → parseStoredEmailBody per row
```

- [ ] **Step 2: `renderInvoiceUnderpaymentEmail`**

```ts
export async function renderInvoiceUnderpaymentEmail(fromDb, ctx) {
  const entry = getEmailTemplateEntry('invoice_underpayment')
  const subject = fromDb?.subject ?? entry.defaultSubject
  const blocks = fromDb?.blocks ?? entry.defaultBlocks
  try {
    return await renderEmailFromBlocks({ key: 'invoice_underpayment', subject, blocks, vars: varsFromCtx(ctx) })
  } catch {
    return await renderEmailFromBlocks({ key: 'invoice_underpayment', subject: entry.defaultSubject, blocks: entry.defaultBlocks, vars: varsFromCtx(ctx) })
  }
}
```

- [ ] **Step 3: `resolveMagicLinkEmailContent`**

Return `{ subject, text, html }` semua dari `renderEmailFromBlocks`; **hapus** `introText` dan pemakaian `renderMagicLinkEmail` terpisah di `auth.ts`:

```ts
const { subject, text, html } = await resolveMagicLinkEmailContent(url)
await sendTransactionalEmail({ to: email, subject, text, html })
```

- [ ] **Step 4: `send-invoice-email.ts`** — ganti `html: pre-wrap` dengan `html` dari render.

- [ ] **Step 5: Run affected tests**

```bash
pnpm vitest run src/lib/email-templates/render-invoice-email.test.ts src/lib/email-templates/render-email-from-blocks.test.ts src/lib/auth/emails/render-emails.test.ts
```

- [ ] **Step 6: Commit**

---

### Task 7: Server actions + schema

**Files:**
- Modify: `src/lib/forms/club-email-template-schema.ts`
- Modify: `src/lib/actions/admin-club-email-templates.ts`

- [ ] **Step 1: Schema**

```ts
export const saveClubEmailTemplateFormSchema = z.object({
  key: z.nativeEnum(EmailTemplateKey),
  subject: z.string().trim().min(1).max(200),
  body: z.string().min(2), // JSON string
}).superRefine((data, ctx) => {
  let parsed: StoredEmailTemplateBody
  try {
    parsed = JSON.parse(data.body)
    if (parsed.v !== 1 || !Array.isArray(parsed.blocks)) throw new Error()
  } catch {
    ctx.addIssue({ code: 'custom', path: ['body'], message: 'Format templat tidak valid.' })
    return
  }
  const err = validateEmailTemplateBlocks(data.key, data.subject, parsed.blocks)
  if (err) ctx.addIssue({ code: 'custom', path: ['body'], message: err })
})
```

- [ ] **Step 2: `previewClubEmailTemplate`**

```ts
'use server'
export async function previewClubEmailTemplate(input: {
  key: EmailTemplateKey
  subject: string
  body: string
}): Promise<ActionResult<{ html: string; text: string }>> {
  // guardOwner, parse, renderEmailFromBlocks + sampleVars
}
```

- [ ] **Step 3: Update save/reset** — `body` = serialized JSON; reset pakai `CLUB_EMAIL_DEFAULT_BODIES`; `revalidatePath` tambah `/admin/settings/templates/email/${key}/edit`.

- [ ] **Step 4: Commit**

---

### Task 8: `EmailParagraphEditor` (Tiptap)

**Files:**
- Create: `src/components/ui/email-paragraph-editor.tsx`

- [ ] **Step 1: Implement client component** (mirror `wa-template-editor.tsx` lebih kecil)

- StarterKit: `heading: false`, `codeBlock: false`, `blockquote: false`, `strike: false`, `horizontalRule: false`
- Extensions: `Link.configure({ openOnClick: false, validate: href => href.startsWith('https://') || href.startsWith('mailto:') })`, `EmailPlaceholder`, `Placeholder`
- Props: `value: JSONContent`, `onChange`, `allowedTokens`, `tokenMeta`, `disabled`, `onEditorReady`
- Toolbar: Bold, Italic, Link (prompt URL), BulletList, OrderedList, Popover variabel, Undo, Redo

- [ ] **Step 2: Manual smoke** — mount di Storybook tidak ada; cukup typecheck `pnpm exec tsc --noEmit` atau `pnpm lint`

- [ ] **Step 3: Commit**

---

### Task 9: UI indeks email

**Files:**
- Create: `src/components/admin/email-templates/email-templates-index-header.tsx`
- Create: `src/components/admin/email-templates/email-templates-table.tsx`
- Modify: `src/app/admin/settings/templates/email/page.tsx`
- Delete usage: `ClubEmailTemplatesPanel` from page

- [ ] **Step 1: Table** — 2 rows dari `EMAIL_TEMPLATE_KEYS_ORDERED`; kolom Nama, Status (Kustom jika ada row DB), Diubah, link `/admin/settings/templates/email/[key]/edit`

- [ ] **Step 2: Page RSC** — `prisma.clubEmailTemplate.findMany`; pass ke table; header + deskripsi (copy dari spec)

- [ ] **Step 3: Commit**

---

### Task 10: UI halaman edit + pratinjau

**Files:**
- Create: `src/app/admin/settings/templates/email/[key]/edit/page.tsx`
- Create: `src/components/admin/email-templates/email-template-edit-form.tsx`
- Create: `src/components/admin/email-templates/email-template-preview-panel.tsx`
- Create: `src/lib/email-templates/is-email-template-key.ts` (mirror `isWaTemplateKey`)

- [ ] **Step 1: Edit page RSC**

```tsx
// parse key → notFound if invalid
// load db row → parseStoredEmailBody → displaySubject, displayBlocks
// <EmailTemplateEditForm catalogEntry blocks subject isCustomized />
```

- [ ] **Step 2: `EmailTemplateEditForm`**

State: `subject`, `blocks`, `activeParagraphId` untuk sisip token.

Blok list:
- `branding_header` / `invoice_summary` / `bank_details`: Card readonly label + ↑↓ (disabled hapus)
- `paragraph`: `EmailParagraphEditor` + hapus (jika >1) + ↑↓
- `cta_button`: Input label
- `footer_disclaimer`: Input text + hapus blok

Actions: `saveClubEmailTemplate` hidden fields `body={serializeStoredBody({v:1,blocks})}`; reset; `toastCudSuccess` / `toastActionErr`.

Sidebar: token buttons → `insertEmailPlaceholder` on focused editor; checklist dari `analyzeEmailTemplateBlocks`.

Preview: `useTransition` + debounce 300ms call `previewClubEmailTemplate`; `EmailTemplatePreviewPanel` render HTML sandboxed (`sandbox=""` iframe srcDoc).

- [ ] **Step 3: `pnpm build` atau `pnpm lint`**

- [ ] **Step 4: Commit**

---

### Task 11: Cleanup + dokumentasi

**Files:**
- Delete: `src/components/admin/club-email-templates-panel.tsx` (jika tidak dipakai elsewhere)
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-06-05-email-template-editor-design.md` — `status: approved`

- [ ] **Step 1: Grep `club-email-templates-panel` — pastikan nol import**

- [ ] **Step 2: CLAUDE.md** — Route layout + key lib modules (email-template-catalog, email-doc-serializer, render-email-from-blocks, EmailParagraphEditor)

- [ ] **Step 3: Full test run**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(admin): email template block editor with Tiptap and React Email preview"
```

---

## Spec self-review (plan vs spec)

| Spec requirement | Task |
| ---------------- | ---- |
| Blok B kedua template | 1, 9, 10 |
| JSON di `body` v1 | 2, 7 |
| Tiptap paragraf | 3, 8, 10 |
| React Email render | 5, 6 |
| Migrasi plain text | 2 |
| Indeks + edit route | 9, 10 |
| preview server action | 7, 10 |
| Owner guard + audit | 7 |
| Magic link unified pipeline | 6 |
| Invoice HTML proper | 6 |
| Out of scope DnD | — |
| CLAUDE.md | 11 |

**Dependency order:** Task 1→2→3→4→5→6 (backend) dapat paralel UI Task 8 awal; Task 9–10 setelah 7; Task 11 terakhir.

---

## Execution handoff

Plan disimpan di `docs/superpowers/plans/2026-06-05-email-template-editor-plan.md`.

**Dua opsi eksekusi:**

1. **Subagent-Driven (disarankan)** — subagent per task, review antar task  
2. **Inline Execution** — jalankan berurutan di sesi ini dengan checkpoint

Mau yang mana?
