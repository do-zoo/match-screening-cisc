# WA Template Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman template WhatsApp terpisah (indeks kartu/tabel + edit per key) dengan editor Tiptap, chip variabel, katalog token, dan pemindahan template email ke route sendiri.

**Architecture:** Metadata + defaults di `wa-template-catalog.ts`; body DB tetap string WA markdown via `wa-markdown-serializer`; validasi policy membaca katalog; runtime vars dari `wa-template-vars.ts`; UI admin mengikuti pola indeks acara (`AdminListToolbar`).

**Tech Stack:** Next.js 16 App Router, Tiptap (`@tiptap/react`, starter-kit, placeholder), Prisma `WaTemplateKey`, Vitest, Zod, Server Actions + `guardOwner`.

**Spec:** [`docs/superpowers/specs/2026-06-05-wa-template-editor-design.md`](../specs/2026-06-05-wa-template-editor-design.md)

---

## File map (locked)

| File | Action |
| ---- | ------ |
| `src/lib/wa-templates/wa-template-catalog.ts` | Create |
| `src/lib/wa-templates/wa-template-catalog.test.ts` | Create |
| `src/lib/wa-templates/wa-markdown-serializer.ts` | Create |
| `src/lib/wa-templates/wa-markdown-serializer.test.ts` | Create |
| `src/lib/wa-templates/wa-template-vars.ts` | Create |
| `src/lib/wa-templates/wa-template-vars.test.ts` | Create |
| `src/lib/wa-templates/wa-template-policy.ts` | Modify |
| `src/lib/wa-templates/wa-template-policy.test.ts` | Create or extend |
| `src/lib/wa-templates/db-default-template-bodies.ts` | Modify → re-export catalog |
| `src/lib/wa-templates/render-wa-from-db.ts` | Modify |
| `src/lib/wa-templates/build-registration-notify.ts` | Modify |
| `src/lib/admin/admin-wa-templates-list-url.ts` | Create |
| `src/lib/admin/admin-wa-templates-list-url.test.ts` | Create |
| `src/lib/actions/admin-club-wa-templates.ts` | Modify revalidate paths |
| `src/lib/wa-templates/wa-placeholder-extension.ts` | Create (Tiptap node) |
| `src/components/ui/wa-template-editor.tsx` | Create |
| `src/components/admin/wa-templates/*` | Create (5 files) |
| `src/app/admin/settings/whatsapp-templates/page.tsx` | Create |
| `src/app/admin/settings/whatsapp-templates/[key]/edit/page.tsx` | Create |
| `src/app/admin/settings/email-templates/page.tsx` | Create |
| `src/app/admin/settings/templates/page.tsx` | Delete |
| `src/components/admin/settings-templates-tabs.tsx` | Delete |
| `src/components/admin/club-wa-templates-panel.tsx` | Delete |
| `next.config.ts` | Modify redirects |
| `src/components/admin/committee-settings-subnav.tsx` | Modify |
| `src/app/admin/settings/page.tsx` | Modify |
| `CLAUDE.md` | Update routes + lib modules |

---

### Task 1: Katalog template WA

**Files:**
- Create: `src/lib/wa-templates/wa-template-catalog.ts`
- Create: `src/lib/wa-templates/wa-template-catalog.test.ts`
- Modify: `src/lib/wa-templates/db-default-template-bodies.ts`

- [ ] **Step 1: Write failing catalog test**

```ts
// src/lib/wa-templates/wa-template-catalog.test.ts
import { WaTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
  WA_TEMPLATE_CATALOG,
  WA_TEMPLATE_KEYS_ORDERED,
  allowedTokensForKey,
  getWaTemplateEntry,
} from '@/lib/wa-templates/wa-template-catalog'
import { validateWaTemplateBody } from '@/lib/wa-templates/wa-template-policy'

describe('WA_TEMPLATE_CATALOG', () => {
  const enumKeys = Object.values(WaTemplateKey).filter(v => typeof v === 'string') as WaTemplateKey[]

  it('covers every WaTemplateKey', () => {
    expect(new Set(enumKeys)).toEqual(new Set(Object.keys(WA_TEMPLATE_CATALOG)))
  })

  it.each(enumKeys)('defaultBody for %s passes validateWaTemplateBody', key => {
    const entry = getWaTemplateEntry(key)
    expect(validateWaTemplateBody(key, entry.defaultBody)).toBeNull()
  })

  it('orders all keys', () => {
    expect(new Set(WA_TEMPLATE_KEYS_ORDERED)).toEqual(new Set(enumKeys))
  })

  it('allowedTokens merges required and optional', () => {
    const key = WaTemplateKey.approved
    const entry = getWaTemplateEntry(key)
    expect(allowedTokensForKey(key)).toEqual([...entry.requiredTokens, ...entry.optionalTokens])
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm vitest run src/lib/wa-templates/wa-template-catalog.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement catalog**

Create `src/lib/wa-templates/wa-template-catalog.ts` with:

- `WaTemplateCategory = 'pendaftaran' | 'verifikasi' | 'operasi'`
- `WaTemplateCatalogEntry` type per spec
- `SHARED_TOKEN_META` for common tokens (`contact_name`, `event_title`, `registration_id`, `computed_total_idr`, `reason`, `venue`, `ticket_qty`, `ticket_category_name`, `contact_whatsapp`, `start_at_formatted`, `open_gate_at_formatted`, bank fields, `adjustment_amount_idr`)
- `WA_TEMPLATE_CATALOG` — migrate bodies verbatim from current `db-default-template-bodies.ts`; set required/optional per spec table
- Exports: `WA_TEMPLATE_KEYS_ORDERED` (sort by `sortOrder`), `getWaTemplateEntry`, `allowedTokensForKey`, `allTokensForKey`, `isWaTemplateKey(value: string): value is WaTemplateKey`

- [ ] **Step 4: Re-export defaults**

Replace body of `db-default-template-bodies.ts`:

```ts
import type { WaTemplateKey } from '@prisma/client'
import { WA_TEMPLATE_CATALOG } from '@/lib/wa-templates/wa-template-catalog'

export const CLUB_WA_DEFAULT_BODIES = Object.fromEntries(
  Object.entries(WA_TEMPLATE_CATALOG).map(([k, v]) => [k, v.defaultBody]),
) as Record<WaTemplateKey, string>
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm vitest run src/lib/wa-templates/wa-template-catalog.test.ts src/lib/wa-templates/db-default-template-bodies.test.ts
```

---

### Task 2: Validasi policy (required + optional)

**Files:**
- Modify: `src/lib/wa-templates/wa-template-policy.ts`
- Create: `src/lib/wa-templates/wa-template-policy.test.ts`

- [ ] **Step 1: Write failing policy tests**

```ts
import { WaTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { getWaTemplateEntry } from '@/lib/wa-templates/wa-template-catalog'
import { validateWaTemplateBody } from '@/lib/wa-templates/wa-template-policy'

describe('validateWaTemplateBody optional tokens', () => {
  it('allows optional token on approved', () => {
    const entry = getWaTemplateEntry(WaTemplateKey.approved)
    const body = entry.defaultBody + '\nID: {registration_id}'
    expect(validateWaTemplateBody(WaTemplateKey.approved, body)).toBeNull()
  })

  it('rejects unknown token', () => {
    expect(validateWaTemplateBody(WaTemplateKey.rejected, 'Hi {unknown_token}')).toMatch(
      /tidak diperbolehkan/,
    )
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (optional not allowed yet)

- [ ] **Step 3: Update policy**

```ts
import { getWaTemplateEntry, allowedTokensForKey } from '@/lib/wa-templates/wa-template-catalog'

export const REQUIRED_TOKENS: Record<WaTemplateKey, readonly string[]> = Object.fromEntries(
  Object.entries(WaTemplateKey).filter(([, v]) => typeof v === 'string').map(([, key]) => {
    const k = key as WaTemplateKey
    return [k, getWaTemplateEntry(k).requiredTokens]
  }),
) as Record<WaTemplateKey, readonly string[]>

export function validateWaTemplateBody(key: WaTemplateKey, body: string): string | null {
  const trimmed = body.trim()
  if (trimmed.length === 0) return 'Isi templat tidak boleh kosong.'
  const entry = getWaTemplateEntry(key)
  const names = new Set(collectPlaceholderNames(trimmed))
  for (const r of entry.requiredTokens) {
    if (!names.has(r)) return `Templat wajib memuat placeholder {${r}}`
  }
  const allowed = new Set(allowedTokensForKey(key))
  for (const n of collectPlaceholderNames(trimmed)) {
    if (!allowed.has(n)) return `Placeholder {${n}} tidak diperbolehkan untuk templat ini.`
  }
  return null
}
```

- [ ] **Step 4: Run tests — PASS**

```bash
pnpm vitest run src/lib/wa-templates/wa-template-policy.test.ts
```

---

### Task 3: WA Markdown serializer

**Files:**
- Create: `src/lib/wa-templates/wa-markdown-serializer.ts`
- Create: `src/lib/wa-templates/wa-markdown-serializer.test.ts`

**Approach:** Line-oriented parser (not full markdown). Each line → paragraph or list item or blockquote. Inline spans parsed for `*`, `_`, `~`, `` ` ``, and `{token}`.

- [ ] **Step 1: Write failing serializer tests**

```ts
import { WaTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { getWaTemplateEntry } from '@/lib/wa-templates/wa-template-catalog'
import { docToWaMarkdown, waMarkdownToDoc } from '@/lib/wa-templates/wa-markdown-serializer'

describe('wa-markdown-serializer', () => {
  const approved = getWaTemplateEntry(WaTemplateKey.approved)

  it('round-trips bold and placeholder', () => {
    const src = 'Halo *{event_title}* di {venue}'
    const doc = waMarkdownToDoc(src, approved)
    expect(docToWaMarkdown(doc)).toBe(src)
  })

  it('round-trips bullet list', () => {
    const src = '- baris satu\n- baris dua'
    expect(docToWaMarkdown(waMarkdownToDoc(src, approved))).toBe(src)
  })

  it('round-trips default approved body', () => {
    const src = approved.defaultBody
    expect(docToWaMarkdown(waMarkdownToDoc(src, approved))).toBe(src)
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement serializer**

`waMarkdownToDoc(markdown, entry)`:
- Split `\n`; blank line → empty paragraph
- Line matching `/^[-*] (.+)/` → bulletListItem
- Line matching `/^\d+\. (.+)/` → orderedListItem
- Line matching `/^> (.+)/` → blockquote paragraph
- Else paragraph; parse inline with regex alternation for `{token}`, `` `code` ``, `*bold*`, `_italic_`, `~strike~`
- `{token}` → `{ type: 'waPlaceholder', attrs: { token } }` if token ∈ allowedTokensForKey; else still waPlaceholder with `invalid: true`

`docToWaMarkdown(doc)`:
- Walk top-level nodes; join with `\n`
- bulletList → `- item` per line
- orderedList → `1. item`
- blockquote → `> text`
- paragraph → inline serialize
- waPlaceholder → `{token}`

Export types compatible with `@tiptap/core` `JSONContent`.

- [ ] **Step 4: Run tests — PASS**

```bash
pnpm vitest run src/lib/wa-templates/wa-markdown-serializer.test.ts
```

---

### Task 4: Runtime vars builder

**Files:**
- Create: `src/lib/wa-templates/wa-template-vars.ts`
- Create: `src/lib/wa-templates/wa-template-vars.test.ts`

- [ ] **Step 1: Write failing vars test**

```ts
import { WaTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { buildWaTemplateVars, type WaTemplateRenderContext } from '@/lib/wa-templates/wa-template-vars'

const baseCtx: WaTemplateRenderContext = {
  contactName: 'Budi',
  contactWhatsapp: '6281234567890',
  registrationId: 'reg_abc',
  computedTotalIdr: 150000,
  ticketQty: 2,
  ticketCategoryName: 'VIP',
  eventTitle: 'Nobar Final',
  venue: 'Gedung A',
  kickOffAtIso: '2026-07-01T14:00:00.000Z',
  openGateAtIso: '2026-07-01T12:00:00.000Z',
  reason: 'Bukti blur',
  adjustmentAmountIdr: 50000,
  bankName: 'BCA',
  accountNumber: '123',
  accountName: 'CISC',
}

describe('buildWaTemplateVars', () => {
  it('maps approved required fields', () => {
    const vars = buildWaTemplateVars(WaTemplateKey.approved, baseCtx)
    expect(vars.event_title).toBe('Nobar Final')
    expect(vars.venue).toBe('Gedung A')
    expect(vars.start_at_formatted).toMatch(/2026/)
  })

  it('maps optional registration_id when requested', () => {
    const vars = buildWaTemplateVars(WaTemplateKey.approved, baseCtx)
    expect(vars.registration_id).toBe('reg_abc')
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `wa-template-vars.ts`**

- `WaTemplateRenderContext` — all fields optional except those needed per call site; use `''` or sensible default for missing
- `formatWaDate(iso)` — `toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' })`
- `buildWaTemplateVars(key, ctx)` — return flat `Record<string, string>` covering every token in `allTokensForKey(key)` union across catalog (implement all keys; unused tokens still populated for reuse)

- [ ] **Step 4: Refactor `render-wa-from-db.ts`**

Replace per-function positional args with:

```ts
export function renderWaMessageFromDb(
  key: WaTemplateKey,
  bodyFromDb: string | null | undefined,
  ctx: WaTemplateRenderContext,
  fallback: () => string,
): string {
  const t = typeof bodyFromDb === 'string' ? bodyFromDb.trim() : ''
  if (!t) return fallback()
  try {
    return applyWaPlaceholders(t, buildWaTemplateVars(key, ctx))
  } catch {
    return fallback()
  }
}
```

Keep thin wrappers (`renderApprovedMessage`, etc.) delegating to `renderWaMessageFromDb` for backward compatibility.

- [ ] **Step 5: Run tests — PASS**

```bash
pnpm vitest run src/lib/wa-templates/wa-template-vars.test.ts
```

---

### Task 5: Perluas konteks `build-registration-notify`

**Files:**
- Modify: `src/lib/wa-templates/build-registration-notify.ts`
- Modify: `src/app/admin/events/[eventId]/registrants/[registrationId]/page.tsx` (pass extra fields if needed)

- [ ] **Step 1: Extend `RegistrationNotifyInput`**

```ts
export type RegistrationNotifyInput = {
  contactName: string
  contactWhatsapp: string
  registrationId: string
  computedTotalIdr: number
  ticketQty: number
  ticketCategoryName: string
  rejectionReason: string | null
  paymentIssueReason: string | null
  event: {
    title: string
    venueName: string
    kickOffAt: Date
    openGateAt: Date | null
  }
  bank?: { bankName: string; accountNumber: string; accountName: string }
  adjustmentAmountIdr?: number
}
```

- [ ] **Step 2: Map to `WaTemplateRenderContext` inside switch**

Helper `registrationToWaCtx(r, extras?)` in same file or `wa-template-vars.ts`.

- [ ] **Step 3: Update registration detail page** — ensure query selects `registrationId`, `ticketQty`, `ticketCategory.name`, `computedTotalAtSubmit`, `event.openGateAt`, bank account; pass into shell/notify props.

- [ ] **Step 4: Run existing tests + lint**

```bash
pnpm vitest run src/lib/wa-templates/
pnpm lint
```

Fix any broken call sites (grep `RegistrationNotifyInput`, `renderApprovedMessage`).

---

### Task 6: Routing — email pindah + redirect

**Files:**
- Create: `src/app/admin/settings/email-templates/page.tsx`
- Modify: `next.config.ts`
- Modify: `src/components/admin/committee-settings-subnav.tsx`
- Modify: `src/app/admin/settings/page.tsx`
- Delete: `src/app/admin/settings/templates/page.tsx`
- Delete: `src/components/admin/settings-templates-tabs.tsx`

- [ ] **Step 1: Create email page**

Copy load pattern from old `templates/page.tsx` — only email:

```tsx
// src/app/admin/settings/email-templates/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ClubEmailTemplatesPanel } from '@/components/admin/club-email-templates-panel'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { loadClubEmailTemplates } from '@/lib/email-templates/load-club-email-templates'
import { canManageCommitteeAdvancedSettings } from '@/lib/permissions/roles'

export const metadata: Metadata = { title: 'Template email' }

export default async function EmailTemplatesSettingsPage() {
  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) notFound()

  const emailInitial = await loadClubEmailTemplates()

  return (
    <div className='space-y-6'>
      {/* breadcrumb + h1 Template email */}
      <ClubEmailTemplatesPanel initialFromDb={emailInitial} />
    </div>
  )
}
```

- [ ] **Step 2: Update `next.config.ts` redirects**

Remove redirect `whatsapp-templates → templates?tab=wa`. Add:

```ts
{ source: '/admin/settings/templates', destination: '/admin/settings', permanent: true },
{ source: '/admin/settings/templates/:path*', destination: '/admin/settings', permanent: true },
```

(Query `?tab=wa` handled by `:path*` won't work — add explicit:)

```ts
{
  source: '/admin/settings/templates',
  has: [{ type: 'query', key: 'tab', value: 'wa' }],
  destination: '/admin/settings/whatsapp-templates',
  permanent: true,
},
{
  source: '/admin/settings/templates',
  has: [{ type: 'query', key: 'tab', value: 'email' }],
  destination: '/admin/settings/email-templates',
  permanent: true,
},
{
  source: '/admin/settings/templates',
  destination: '/admin/settings',
  permanent: true,
},
```

- [ ] **Step 3: Update sub-nav**

Replace single templates link with:

```ts
{ href: '/admin/settings/whatsapp-templates', label: 'Template WA' },
{ href: '/admin/settings/email-templates', label: 'Template email' },
```

- [ ] **Step 4: Update settings hub** — two `SettingsCard` components instead of one "Template pesan".

- [ ] **Step 5: Delete old combined templates page + tabs component**

- [ ] **Step 6: Update `admin-club-email-templates.ts` revalidatePath** → `/admin/settings/email-templates`

- [ ] **Step 7: `pnpm build` smoke** (or `pnpm lint`)

---

### Task 7: List URL helper

**Files:**
- Create: `src/lib/admin/admin-wa-templates-list-url.ts`
- Create: `src/lib/admin/admin-wa-templates-list-url.test.ts`

- [ ] **Step 1: Test parse/build**

```ts
import { describe, expect, it } from 'vitest'
import {
  buildAdminWaTemplatesListUrl,
  parseAdminWaTemplatesListParams,
} from '@/lib/admin/admin-wa-templates-list-url'

describe('admin-wa-templates-list-url', () => {
  it('builds table view url', () => {
    expect(
      buildAdminWaTemplatesListUrl({ tab: 'verifikasi', view: 'table', q: 'disetujui' }),
    ).toBe('/admin/settings/whatsapp-templates?tab=verifikasi&view=tabel&q=disetujui')
  })

  it('parses params', () => {
    expect(
      parseAdminWaTemplatesListParams({ tab: 'operasi', view: 'tabel', q: '  refund ' }),
    ).toEqual({ tab: 'operasi', q: 'refund', view: 'table' })
  })
})
```

- [ ] **Step 2: Implement** — mirror `admin-venues-index.ts`; `WaTemplatesIndexTab = 'all' | 'pendaftaran' | 'verifikasi' | 'operasi'`; reuse `parseEventsIndexViewParam` / `parseEventsIndexSearchQuery`.

- [ ] **Step 3: Run test — PASS**

---

### Task 8: Halaman indeks WA

**Files:**
- Create: `src/app/admin/settings/whatsapp-templates/page.tsx`
- Create: `src/components/admin/wa-templates/wa-templates-index-header.tsx`
- Create: `src/components/admin/wa-templates/wa-templates-index-toolbar.tsx`
- Create: `src/components/admin/wa-templates/wa-templates-cards-view.tsx`
- Create: `src/components/admin/wa-templates/wa-templates-table.tsx`

- [ ] **Step 1: RSC page**

- `guardOwner` via `canManageCommitteeAdvancedSettings` + `notFound()`
- Load `prisma.clubWaTemplate.findMany({ select: { key, body, updatedAt } })`
- Merge with `WA_TEMPLATE_KEYS_ORDERED` + catalog metadata
- Filter client-side or server-side by `tab` + `q` (7 rows — server filter OK)
- Redirect if `tab` missing → `?tab=all`
- Render header + toolbar + cards OR table based on `view`

- [ ] **Step 2: Cards view** — Card per template; badge kategori; `line-clamp-2 font-mono text-xs` snippet; Badge Kustom/Bawaan; Button Edit → `/admin/settings/whatsapp-templates/[key]/edit`

- [ ] **Step 3: Table view** — `@tanstack/react-table` or simple HTML table matching `admin-events-table.tsx` column patterns

- [ ] **Step 4: Toolbar** — `AdminListToolbar` + category filter options + view toggle

- [ ] **Step 5: Manual check** — `pnpm dev`, browse as Owner

---

### Task 9: Tiptap placeholder extension

**Files:**
- Create: `src/lib/wa-templates/wa-placeholder-extension.ts`

- [ ] **Step 1: Implement `WaPlaceholder` node**

```ts
import { Node, mergeAttributes } from '@tiptap/core'

export type WaPlaceholderOptions = {
  allowedTokens: Set<string>
  requiredTokens: Set<string>
  tokenMeta: Record<string, { labelId: string }>
}

export const WaPlaceholder = Node.create<WaPlaceholderOptions>({
  name: 'waPlaceholder',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { token: { default: null }, invalid: { default: false } }
  },
  parseHTML() {
    return [{ tag: 'span[data-wa-placeholder]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const token = node.attrs.token as string
    const label = this.options.tokenMeta[token]?.labelId ?? token
    const required = this.options.requiredTokens.has(token)
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wa-placeholder': token,
        'data-required': required ? 'true' : 'false',
        class: /* chip classes */,
      }),
      label,
    ]
  },
})
```

- [ ] **Step 2: Export command `insertWaPlaceholder(token: string)`**

---

### Task 10: `WaTemplateEditor` component

**Files:**
- Create: `src/components/ui/wa-template-editor.tsx`

- [ ] **Step 1: Props**

```ts
type WaTemplateEditorProps = {
  catalogEntry: WaTemplateCatalogEntry
  value: string // WA markdown
  onChange: (markdown: string) => void
  disabled?: boolean
  onValidationChange?: (state: { missingRequired: string[]; invalidTokens: string[] }) => void
}
```

- [ ] **Step 2: Editor setup**

- Extensions: StarterKit (disable heading, codeBlock, link, underline optional), Strike, Placeholder, WaPlaceholder configured from entry
- Initial content: `waMarkdownToDoc(value, entry)`
- onUpdate: `docToWaMarkdown(editor.getJSON())` → onChange
- Compute missing required + invalid tokens on each update → `onValidationChange`

- [ ] **Step 3: Toolbar**

Buttons: Bold, Italic, Strike, Code, BulletList, OrderedList, Blockquote, Undo, Redo, **Sisipkan variabel** (Popover grouped Wajib/Opsional with search — filter `allowedTokensForKey`)

- [ ] **Step 4: Autocomplete extension**

Use `@tiptap/suggestion` or InputRule: on `{` trigger popup listing allowed tokens; on select → `insertWaPlaceholder`.

- [ ] **Step 5: Styles in `globals.css`**

`.wa-placeholder-chip`, `.wa-placeholder-chip--required`, `.wa-placeholder-chip--optional`, `.wa-placeholder-chip--invalid`

---

### Task 11: Halaman edit + form

**Files:**
- Create: `src/app/admin/settings/whatsapp-templates/[key]/edit/page.tsx`
- Create: `src/components/admin/wa-templates/wa-template-edit-form.tsx`

- [ ] **Step 1: RSC edit page**

- Parse `[key]`; `isWaTemplateKey(key)` or `notFound()`
- Load DB body; `displayBody = dbRow?.body ?? catalog.defaultBody`
- Pass to client form: `catalogEntry`, `displayBody`, `isCustomized` (db row exists)

- [ ] **Step 2: Client form**

- `useState` for markdown body
- `WaTemplateEditor` controlled
- Sidebar: variable list (click → editor command insert); checklist required; preview panel calling `applyWaPlaceholders(body, sampleValuesFromTokenMeta)`
- Forms: save via `useActionState(saveClubWaTemplateBody)` with hidden `key` + hidden/controlled `body`
- Reset via `resetClubWaTemplateBody`; on success reset local state to catalog default
- Disable submit when `missingRequired.length > 0 || invalidTokens.length > 0`
- `toastCudSuccess` / `toastActionErr`

- [ ] **Step 3: Update server actions revalidatePath**

In `admin-club-wa-templates.ts`:

```ts
revalidatePath('/admin/settings/whatsapp-templates')
revalidatePath(`/admin/settings/whatsapp-templates/${key}/edit`)
```

Remove `/admin/settings/templates`.

Use catalog default on reset:

```ts
const body = getWaTemplateEntry(parsedKey.data).defaultBody
```

- [ ] **Step 4: Delete `club-wa-templates-panel.tsx`**

---

### Task 12: Dokumentasi & verifikasi akhir

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Route layout: replace combined templates with WA + email paths; add lib modules (`wa-template-catalog`, `wa-markdown-serializer`, `wa-template-vars`, `admin-wa-templates-list-url`).

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
pnpm lint
pnpm build
```

- [ ] **Step 3: Manual QA checklist**

- [ ] `/admin/settings/whatsapp-templates` — kartu + tabel + filter + cari
- [ ] Edit template — format tebal/miring, sisip variabel (3 jalur), preview, simpan, reset
- [ ] Detail registrasi — dialog WA preview dengan token opsional di body DB
- [ ] `/admin/settings/email-templates` — panel email unchanged
- [ ] Redirect `/admin/settings/templates?tab=wa` → WA index

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| Katalog + seeder source | 1 |
| Required + optional validation | 2 |
| Tiptap + WA serializer | 3, 9, 10 |
| Variable chips + insert + autocomplete | 9, 10, 11 |
| Index card/table | 7, 8 |
| Edit page + preview | 11 |
| Runtime vars expansion | 4, 5 |
| Email move only | 6 |
| Redirects + hub + sub-nav | 6 |
| CLAUDE.md | 12 |

## Out of scope (do not implement)

- Seeder CLI
- Email index/Tiptap
- Custom template keys beyond enum
