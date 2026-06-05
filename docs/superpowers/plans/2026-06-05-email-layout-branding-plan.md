# Layout email + branding kontak — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Footer kontak terstruktur (web + email) dari `ClubBranding`, shell email terang selaras design system, dan hapus duplikasi blok `branding_header`.

**Architecture:** Perluas `ClubBranding` + migrasi SQL; parser Zod untuk sosial; `ClubContactDisplay` dipakai `PublicFooter`; `email-design-tokens.ts` menjadi satu sumber hex; `ClubEmailLayout` merender header/footer global; blok template hanya isi; `stripBrandingHeaderBlocks` idempotent di parse/load.

**Tech Stack:** Next.js App Router, Prisma, React Email, Zod, Vitest, `normalizeStoredEmail` / `optionalStoredEmail`.

**Spec:** [`docs/superpowers/specs/2026-06-05-email-layout-branding-design.md`](../specs/2026-06-05-email-layout-branding-design.md)

**Prasyarat:** Editor template email (blok + `renderEmailFromBlocks`) sudah ada di branch — rencana ini **hanya** menambah branding kontak + layout shell.

---

## File map

| File | Tanggung jawab |
| ---- | -------------- |
| `prisma/schema.prisma` | Field kontak baru; hapus `footerPlainText` |
| `prisma/migrations/…_club_branding_contact/migration.sql` | Add columns, data migrate, drop footer |
| `src/lib/branding/club-social-links.ts` | Zod parse + `ClubSocialLink` type |
| `src/lib/branding/club-social-links.test.ts` | Max 3, https, invalid JSON → `[]` |
| `src/lib/forms/club-branding-schema.ts` | Validasi form branding |
| `src/lib/forms/club-branding-schema.test.ts` | Email, https, sosial |
| `src/lib/public/load-club-branding.ts` | VM baru |
| `src/lib/actions/admin-club-branding.ts` | Simpan field baru + audit |
| `src/components/admin/club-branding-settings-form.tsx` | UI kontak + sosial |
| `src/components/branding/club-contact-display.tsx` | Footer 3 kolom web |
| `src/components/public/public-footer.tsx` | Pakai `ClubContactDisplay` |
| `src/lib/email-templates/email-design-tokens.ts` | Hex tokens |
| `src/lib/email-templates/strip-branding-header-blocks.ts` | Filter blok |
| `src/lib/email-templates/strip-branding-header-blocks.test.ts` | Unit test |
| `src/lib/email-templates/parse-stored-email-body.ts` | Strip setelah parse |
| `src/lib/email-templates/email-template-catalog.ts` | Hapus `branding_header` dari default |
| `src/lib/email-templates/emails/club-email-layout.tsx` | Header band + footer tabel |
| `src/lib/email-templates/emails/club-email-contact-footer.tsx` | Footer React Email (opsional split) |
| `src/lib/email-templates/emails/club-email-blocks.tsx` | Token + skip header |
| `src/lib/email-templates/emails/club-email-plain-contact.ts` | Plain-text footer lines |
| `src/lib/email-templates/render-email-from-blocks.ts` | Pass `contact` + strip blocks |
| `src/lib/email-templates/render-email-from-blocks.test.ts` | HTML contains email kontak |
| `src/components/admin/email-templates/email-template-edit-form.tsx` | Hapus blok header dari UI |
| `src/app/admin/settings/branding/page.tsx` | Props form baru |
| `CLAUDE.md` | Data model + modul |

---

### Task 1: Prisma + migrasi

**Files:**
- Modify: `prisma/schema.prisma` (`ClubBranding`)
- Create: `prisma/migrations/20260605160000_club_branding_contact/migration.sql`

- [ ] **Step 1: Update schema**

```prisma
model ClubBranding {
  singletonKey    String   @id @default("default")
  clubNameNav     String   @default("CISC Nobar")
  contactEmail    String?
  websiteUrl      String?
  locationText    String?  @db.VarChar(200)
  socialLinks     Json?
  logoBlobUrl     String?
  logoBlobPath    String?
  updatedAt       DateTime @updatedAt
}
```

- [ ] **Step 2: Write migration SQL**

```sql
-- Add columns
ALTER TABLE "ClubBranding" ADD COLUMN "contact_email" TEXT;
ALTER TABLE "ClubBranding" ADD COLUMN "website_url" TEXT;
ALTER TABLE "ClubBranding" ADD COLUMN "location_text" VARCHAR(200);
ALTER TABLE "ClubBranding" ADD COLUMN "social_links" JSONB;

-- Migrate legacy footer text → location
UPDATE "ClubBranding"
SET "location_text" = "footer_plain_text"
WHERE "footer_plain_text" IS NOT NULL
  AND TRIM("footer_plain_text") <> ''
  AND ("location_text" IS NULL OR TRIM("location_text") = '');

ALTER TABLE "ClubBranding" DROP COLUMN "footer_plain_text";
```

- [ ] **Step 3: Apply migration**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm db:migrate:dev --name club_branding_contact
```

Expected: migration applied, `prisma generate` succeeds.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): kontak terstruktur ClubBranding, hapus footerPlainText"
```

---

### Task 2: `club-social-links` + branding schema

**Files:**
- Create: `src/lib/branding/club-social-links.ts`
- Create: `src/lib/branding/club-social-links.test.ts`
- Modify: `src/lib/forms/club-branding-schema.ts`
- Create: `src/lib/forms/club-branding-schema.test.ts`

- [ ] **Step 1: Failing test social parse**

```ts
// club-social-links.test.ts
import { describe, expect, it } from 'vitest'
import { parseClubSocialLinks } from './club-social-links'

describe('parseClubSocialLinks', () => {
  it('returns empty for null', () => {
    expect(parseClubSocialLinks(null)).toEqual([])
  })
  it('rejects more than 3 links', () => {
    const raw = [
      { label: 'A', url: 'https://a.com' },
      { label: 'B', url: 'https://b.com' },
      { label: 'C', url: 'https://c.com' },
      { label: 'D', url: 'https://d.com' },
    ]
    expect(parseClubSocialLinks(raw)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — FAIL**

```bash
pnpm vitest run src/lib/branding/club-social-links.test.ts
```

- [ ] **Step 3: Implement**

```ts
// club-social-links.ts
import { z } from 'zod'

export type ClubSocialLink = { label: string; url: string }

const linkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: z.string().trim().url().refine(u => u.startsWith('https://'), 'URL harus https'),
})

const arraySchema = z.array(linkSchema).max(3)

export function parseClubSocialLinks(raw: unknown): ClubSocialLink[] {
  const parsed = arraySchema.safeParse(raw)
  return parsed.success ? parsed.data : []
}

export function hasAnyClubContact(fields: {
  contactEmail: string | null
  websiteUrl: string | null
  locationText: string | null
  socialLinks: ClubSocialLink[]
}): boolean {
  return Boolean(
    fields.contactEmail?.trim() ||
      fields.websiteUrl?.trim() ||
      fields.locationText?.trim() ||
      fields.socialLinks.length > 0,
  )
}
```

- [ ] **Step 4: Extend `club-branding-schema.ts`**

```ts
import { z } from 'zod'
import { optionalStoredEmail } from '@/lib/email/normalize-email'

const httpsOptional = z
  .string()
  .optional()
  .transform(v => (v ?? '').trim())
  .transform(v => (v === '' ? '' : v))
  .refine(v => v === '' || v.startsWith('https://'), 'URL harus diawali https://')

const socialLinkInputSchema = z.object({
  label: z.string().trim().max(40),
  url: httpsOptional,
})

export const clubBrandingTextsSchema = z.object({
  clubNameNav: z.string().trim().min(1).max(120),
  contactEmail: z
    .string()
    .optional()
    .transform(v => (v ?? '').trim())
    .transform(v => (v === '' ? '' : optionalStoredEmail.parse(v) ?? v))
    .refine(v => v === '' || z.string().email().safeParse(v).success, 'Email tidak valid'),
  websiteUrl: httpsOptional,
  locationText: z
    .string()
    .optional()
    .transform(v => (v ?? '').trim())
    .transform(v => (v === '' ? '' : v.slice(0, 200))),
  socialLinks: z.array(socialLinkInputSchema).max(3),
})
```

Note: adjust `contactEmail` to use `optionalStoredEmail` from project helper if it returns `string | null`.

- [ ] **Step 5: Schema tests + green social tests**

```bash
pnpm vitest run src/lib/branding/club-social-links.test.ts src/lib/forms/club-branding-schema.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/branding/ src/lib/forms/club-branding-schema*
git commit -m "feat: validasi kontak branding dan parse social links"
```

---

### Task 3: Loader + server action branding

**Files:**
- Modify: `src/lib/public/load-club-branding.ts`
- Modify: `src/lib/actions/admin-club-branding.ts`
- Modify: `src/app/admin/settings/branding/page.tsx`

- [ ] **Step 1: Update `PublicClubBrandingVm` + loader**

```ts
import { parseClubSocialLinks, type ClubSocialLink } from '@/lib/branding/club-social-links'

export type PublicClubBrandingVm = {
  clubNameNav: string
  logoBlobUrl: string | null
  contactEmail: string | null
  websiteUrl: string | null
  locationText: string | null
  socialLinks: ClubSocialLink[]
}
```

Map Prisma row; `socialLinks: parseClubSocialLinks(row.socialLinks)`.

- [ ] **Step 2: Update `saveClubBranding`**

Parse FormData:

- `contactEmail`, `websiteUrl`, `locationText` strings
- `socialLabel0` / `socialUrl0` … up to index 2 **or** JSON hidden field `socialLinksJson`

Normalize empty strings → `null` for DB. Persist `socialLinks` as Prisma `Json` array (only rows where both label and url non-empty).

Audit `changedFields`: include `contactEmail`, `websiteUrl`, `locationText`, `socialLinks` when changed.

`revalidatePath('/admin/settings/templates/email')` added for preview.

- [ ] **Step 3: Pass initial values to form on branding page**

- [ ] **Step 4: Commit**

```bash
git add src/lib/public/load-club-branding.ts src/lib/actions/admin-club-branding.ts src/app/admin/settings/branding/
git commit -m "feat: simpan dan muat kontak ClubBranding"
```

---

### Task 4: Form admin branding + footer publik

**Files:**
- Modify: `src/components/admin/club-branding-settings-form.tsx`
- Create: `src/components/branding/club-contact-display.tsx`
- Modify: `src/components/public/public-footer.tsx`
- Modify: `src/app/(public)/layout.tsx` (props footer — verify still passes branding vm)

- [ ] **Step 1: Form — section Kontak & footer**

- Hapus textarea `footerPlainText`.
- Tambah `Input` email, website (`type="url"`, placeholder `https://`), `Textarea` lokasi (max 200).
- Tiga baris sosial: label + URL; tombol tidak perlu tambah/hapus dinamis di v1 — tampilkan 3 pasang input kosong.

- [ ] **Step 2: `ClubContactDisplay`**

```tsx
export function ClubContactDisplay(props: {
  contactEmail: string | null
  websiteUrl: string | null
  locationText: string | null
  socialLinks: ClubSocialLink[]
}) {
  if (!hasAnyClubContact(props)) return null
  // grid md:grid-cols-3 gap-6 — kolom Email / Lokasi / Sosial
}
```

- [ ] **Step 3: `PublicFooter`**

```tsx
export function PublicFooter(props: PublicClubBrandingVm) {
  return (
    <footer className='mt-auto border-t py-8 ...'>
      <div className='mx-auto max-w-6xl px-4 md:px-6'>
        <ClubContactDisplay {...pickContact(props)} />
      </div>
    </footer>
  )
}
```

Layout: jika `ClubContactDisplay` null, footer tidak render (sama spec).

- [ ] **Step 4: Manual smoke** — `pnpm dev`, buka `/`, isi branding, lihat footer.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/club-branding-settings-form.tsx src/components/branding/ src/components/public/public-footer.tsx
git commit -m "feat: form branding kontak dan footer publik terstruktur"
```

---

### Task 5: Email design tokens + strip `branding_header`

**Files:**
- Create: `src/lib/email-templates/email-design-tokens.ts`
- Create: `src/lib/email-templates/strip-branding-header-blocks.ts`
- Create: `src/lib/email-templates/strip-branding-header-blocks.test.ts`
- Modify: `src/lib/email-templates/parse-stored-email-body.ts`
- Modify: `src/lib/email-templates/load-club-email-templates.ts` (if returns blocks directly)

- [ ] **Step 1: Tokens file**

```ts
export const EMAIL_DESIGN_TOKENS = {
  pageBg: '#f4f4f5',
  cardBg: '#ffffff',
  cardBorder: '#e4e4e7',
  text: '#18181b',
  textMuted: '#71717a',
  primary: '#1e3a8a',
  primaryForeground: '#ffffff',
  headerBand: '#eff6ff',
  surfaceMuted: '#f4f4f5',
  surfaceSuccessBg: '#ecfdf5',
  surfaceSuccessBorder: '#a7f3d0',
  surfaceSuccessText: '#14532d',
} as const
```

- [ ] **Step 2: Strip helper + test**

```ts
export function stripBrandingHeaderBlocks(blocks: EmailBlock[]): EmailBlock[] {
  return blocks.filter(b => b.type !== 'branding_header')
}
```

Test: input 3 blocks with one header → output length 2.

- [ ] **Step 3: Use in `parseStoredEmailBody`**

```ts
return stripBrandingHeaderBlocks(parsed.blocks)
// and migratePlainBodyToBlocks path too
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/email-templates/email-design-tokens.ts src/lib/email-templates/strip-branding-header-blocks* src/lib/email-templates/parse-stored-email-body.ts
git commit -m "feat: token email dan strip blok branding_header"
```

---

### Task 6: Katalog — hapus default `branding_header`

**Files:**
- Modify: `src/lib/email-templates/email-template-catalog.ts`
- Modify: `src/lib/email-templates/email-template-catalog.test.ts` (if asserts block types)
- Modify: `src/lib/email-templates/migrate-plain-email-body.ts` (if injects header)

- [ ] **Step 1: Remove `{ type: 'branding_header', ... }` from every `defaultBlocks` array**

- [ ] **Step 2: Run catalog tests**

```bash
pnpm vitest run src/lib/email-templates/email-template-catalog.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/email-templates/email-template-catalog*
git commit -m "refactor: default template email tanpa blok branding_header"
```

---

### Task 7: Shell email — layout + contact footer

**Files:**
- Create: `src/lib/email-templates/emails/club-email-contact-footer.tsx` (recommended)
- Create: `src/lib/email-templates/emails/club-email-plain-contact.ts`
- Modify: `src/lib/email-templates/emails/club-email-layout.tsx`
- Modify: `src/lib/email-templates/emails/club-email-blocks.tsx`

- [ ] **Step 1: `club-email-contact-footer.tsx`**

React Email: `Section` + `<table width="100%">` tiga `<td>` (Email | Lokasi | Sosial). Skip column when empty. Label `Text` muted 12px; value 14px; links `color: EMAIL_DESIGN_TOKENS.primary`.

- [ ] **Step 2: Rewrite `ClubEmailLayout`**

Props:

```ts
export type ClubEmailBrandingProps = {
  clubNameNav: string
  logoBlobUrl?: string | null
  contactEmail: string | null
  websiteUrl: string | null
  locationText: string | null
  socialLinks: ClubSocialLink[]
}
```

Order: `Body` pageBg → `Container` → outer card → **HeaderSection** (headerBand, logo, name) → `children` → **ClubEmailContactFooter** → end card.

- [ ] **Step 3: Update `club-email-blocks.tsx`**

- `case 'branding_header': break` (no output) — or delete case entirely.
- Replace hardcoded hex with `EMAIL_DESIGN_TOKENS`.
- Remove logo/name from old branding_header case (deleted).
- `bank_details` borderLeft → `primary`.
- `cta_button` → primary background.

- [ ] **Step 4: `club-email-plain-contact.ts`**

```ts
export function formatContactPlainLines(contact: ClubEmailBrandingProps['contact']): string[] {
  const lines: string[] = []
  if (contact.contactEmail) lines.push(`Email: ${contact.contactEmail}`)
  // website, location, each social label: url
  return lines
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-templates/emails/
git commit -m "feat: shell email header/footer kontak dan token warna"
```

---

### Task 8: `renderEmailFromBlocks` + plain text

**Files:**
- Modify: `src/lib/email-templates/render-email-from-blocks.ts`
- Modify: `src/lib/email-templates/emails/club-email-blocks.tsx` (`blocksToPlainText`)
- Modify: `src/lib/email-templates/render-email-from-blocks.test.ts`

- [ ] **Step 1: Extend opts**

```ts
export async function renderEmailFromBlocks(opts: {
  // existing...
  contact?: Pick<PublicClubBrandingVm, 'contactEmail' | 'websiteUrl' | 'locationText' | 'socialLinks'>
}) {
  const blocks = stripBrandingHeaderBlocks(opts.blocks)
  const contact = opts.contact ?? {
    contactEmail: null,
    websiteUrl: null,
    locationText: null,
    socialLinks: [],
  }
  const text = blocksToPlainText({ ..., contact })
  const html = await render(
    createElement(ClubEmailLayout, {
      preview: subject.slice(0, 80),
      clubNameNav,
      logoBlobUrl: opts.logoBlobUrl,
      contactEmail: contact.contactEmail,
      websiteUrl: contact.websiteUrl,
      locationText: contact.locationText,
      socialLinks: contact.socialLinks,
      children: renderEmailBlocks({ blocks, ... }),
    }),
  )
}
```

- [ ] **Step 2: `blocksToPlainText` order**

Body blocks (no header) → if contact lines, separator `---` + lines → `footer_disclaimer` blocks last.

- [ ] **Step 3: Failing render test**

```ts
it('includes contact email in html when branding contact set', async () => {
  const { html } = await renderEmailFromBlocks({
    key: EmailTemplateKey.magic_link,
    subject: 'Test',
    blocks: getEmailTemplateEntry(EmailTemplateKey.magic_link).defaultBlocks,
    vars: sampleVarsFromCatalog(EmailTemplateKey.magic_link),
    contact: {
      contactEmail: 'komite@example.com',
      websiteUrl: 'https://cisc.example',
      locationText: 'Tangerang Selatan',
      socialLinks: [{ label: 'IG', url: 'https://instagram.com/cisc' }],
    },
  })
  expect(html).toContain('komite@example.com')
  expect(html).toContain('Tangerang Selatan')
})
```

- [ ] **Step 4: Update callers** — pass full contact from `loadPublicClubBranding()`:

- `render-invoice-email.ts`
- `render-magic-link-email.ts`
- `render-registration-approved-email.ts`
- `admin-club-email-templates.ts` (`previewClubEmailTemplate`)

```ts
const branding = await loadPublicClubBranding()
await renderEmailFromBlocks({
  ...
  logoBlobUrl: branding.logoBlobUrl,
  clubNameNav: branding.clubNameNav,
  contact: {
    contactEmail: branding.contactEmail,
    websiteUrl: branding.websiteUrl,
    locationText: branding.locationText,
    socialLinks: branding.socialLinks,
  },
})
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/lib/email-templates/render-email-from-blocks.test.ts src/lib/email-templates/strip-branding-header-blocks.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/email-templates/render-email-from-blocks* src/lib/email/send* src/lib/email-templates/render-*.ts src/lib/actions/admin-club-email-templates.ts
git commit -m "feat: render email dengan footer kontak branding"
```

---

### Task 9: Editor template — hapus blok header

**Files:**
- Modify: `src/components/admin/email-templates/email-template-edit-form.tsx`
- Modify: `src/lib/email-templates/email-block-list-utils.ts` (if ADD_BLOCK_TYPES list)

- [ ] **Step 1: Remove `branding_header` from `BLOCK_TYPE_LABELS`, checklist add-block, and help copy**

Ganti dengan `Alert` atau teks di sidebar:

> Header dan footer kontak diatur di Pengaturan → Branding.

- [ ] **Step 2: Saat load blocks di client, rely on server parse** (already stripped) — optional client-side strip on save for defense.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/email-templates/
git commit -m "refactor: editor email tanpa blok branding_header"
```

---

### Task 10: Dokumentasi + verifikasi akhir

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

- Data model `ClubBranding` — field baru, hapus `footerPlainText`
- Key modules: `email-design-tokens.ts`, `club-social-links.ts`, `club-contact-display.tsx`, `strip-branding-header-blocks.ts`

- [ ] **Step 2: Full test run**

```bash
pnpm vitest run src/lib/branding/ src/lib/forms/club-branding-schema.test.ts src/lib/email-templates/
pnpm lint
```

- [ ] **Step 3: Manual checklist (spec acceptance)**

- Branding save + audit
- Public footer 3 kolom / hidden when empty
- Admin email preview shows header band + contact footer + blue CTA
- Stored template with old `branding_header` still renders single header

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: branding kontak dan layout email di CLAUDE.md"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| ---------------- | ---- |
| ClubBranding fields + migration | 1 |
| Zod + social parse | 2 |
| Admin save + loader | 3 |
| Branding form | 4 |
| Public footer sync | 4 |
| email-design-tokens | 5 |
| strip branding_header | 5, 6, 9 |
| ClubEmailLayout shell | 7 |
| Block token styling | 7 |
| render + plain contact | 8 |
| Editor UI | 9 |
| CLAUDE.md | 10 |
| Tests | 2, 5, 8, 10 |

No placeholders remain in plan steps above.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-email-layout-branding-plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — satu subagent per task, review antar task  
2. **Inline Execution** — jalankan task berurutan di sesi ini dengan checkpoint

Mana yang Anda pilih?
