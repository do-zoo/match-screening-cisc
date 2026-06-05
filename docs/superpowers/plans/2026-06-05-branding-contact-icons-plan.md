# Ikon kontak branding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tampilkan ikon PNG konsisten di footer kontak publik, preview form admin, dan footer email; deteksi platform sosial dari URL; tanpa migrasi DB.

**Architecture:** Modul `lib/branding/contact-*` (deteksi hostname, registry PNG, label fallback) dipakai web + email; asset statis di `public/branding-icons/`; `ContactIconRow` untuk web; `ClubEmailContactFooter` menambah `<Img>` absolut dari `BETTER_AUTH_URL`.

**Tech Stack:** Next.js, React Email, Vitest, TypeScript, PNG statis di `public/`.

**Spec:** [`docs/superpowers/specs/2026-06-05-branding-contact-icons-design.md`](../specs/2026-06-05-branding-contact-icons-design.md)

---

## File map

| File | Tanggung jawab |
| ---- | -------------- |
| `src/lib/branding/contact-platform.ts` | `ContactPlatformKey`, `detectContactPlatform`, `normalizeHostname` |
| `src/lib/branding/contact-platform.test.ts` | Matrix hostname |
| `src/lib/branding/contact-icon-registry.ts` | `pngFileName`, `defaultLabel` per key |
| `src/lib/branding/resolve-contact-display-label.ts` | Label tampilan sosial/website |
| `src/lib/branding/resolve-contact-display-label.test.ts` | Prioritas label |
| `src/lib/branding/branding-icon-url.ts` | Path publik + URL absolut email |
| `src/lib/branding/branding-icon-url.test.ts` | URL builder |
| `public/branding-icons/*.png` | Asset 20×20 |
| `src/components/branding/contact-icon-row.tsx` | Baris ikon + children (web) |
| `src/components/branding/club-contact-display.tsx` | Refactor pakai `ContactIconRow` |
| `src/lib/email-templates/emails/club-email-contact-footer.tsx` | `<Img>` + teks |
| `src/lib/email-templates/emails/club-email-contact-footer.test.ts` | Assert `src` absolut |
| `src/components/admin/branding-field-icon-preview.tsx` | Preview client |
| `src/components/admin/club-branding-settings-form.tsx` | Wire preview + placeholder |
| `src/lib/email-templates/render-email-from-blocks.test.ts` | Assert ikon di HTML |
| `CLAUDE.md` | Modul + asset |

---

### Task 1: Deteksi platform + registry

**Files:**
- Create: `src/lib/branding/contact-platform.ts`
- Create: `src/lib/branding/contact-platform.test.ts`
- Create: `src/lib/branding/contact-icon-registry.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/branding/contact-platform.test.ts
import { describe, expect, it } from 'vitest'
import { detectContactPlatform, normalizeHostname } from './contact-platform'

describe('normalizeHostname', () => {
  it('strips www', () => {
    expect(normalizeHostname('WWW.Instagram.COM')).toBe('instagram.com')
  })
})

describe('detectContactPlatform', () => {
  it('detects instagram', () => {
    expect(detectContactPlatform('https://www.instagram.com/cisc')).toBe('instagram')
  })
  it('detects youtu.be', () => {
    expect(detectContactPlatform('https://youtu.be/abc')).toBe('youtube')
  })
  it('detects x.com and twitter.com', () => {
    expect(detectContactPlatform('https://x.com/cisc')).toBe('x')
    expect(detectContactPlatform('https://twitter.com/cisc')).toBe('x')
  })
  it('returns link for unknown host', () => {
    expect(detectContactPlatform('https://example.org/page')).toBe('link')
  })
  it('returns link for invalid url', () => {
    expect(detectContactPlatform('not-a-url')).toBe('link')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/branding/contact-platform.test.ts
```

- [ ] **Step 3: Implement platform + registry**

```ts
// src/lib/branding/contact-platform.ts
export type ContactPlatformKey =
  | 'email'
  | 'website'
  | 'location'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'tiktok'
  | 'x'
  | 'linkedin'
  | 'whatsapp'
  | 'threads'
  | 'link'

const HOST_RULES: { key: ContactPlatformKey; hosts: string[] }[] = [
  { key: 'instagram', hosts: ['instagram.com'] },
  { key: 'facebook', hosts: ['facebook.com', 'fb.com', 'm.facebook.com'] },
  { key: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
  { key: 'tiktok', hosts: ['tiktok.com'] },
  { key: 'x', hosts: ['x.com', 'twitter.com'] },
  { key: 'linkedin', hosts: ['linkedin.com'] },
  { key: 'whatsapp', hosts: ['whatsapp.com', 'wa.me'] },
  { key: 'threads', hosts: ['threads.net'] },
]

export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function hostMatchesRule(host: string, ruleHost: string): boolean {
  return host === ruleHost || host.endsWith(`.${ruleHost}`)
}

export function detectContactPlatform(url: string): ContactPlatformKey {
  try {
    const host = normalizeHostname(new URL(url).hostname)
    for (const rule of HOST_RULES) {
      if (rule.hosts.some(h => hostMatchesRule(host, h))) return rule.key
    }
    return 'link'
  } catch {
    return 'link'
  }
}
```

```ts
// src/lib/branding/contact-icon-registry.ts
import type { ContactPlatformKey } from '@/lib/branding/contact-platform'

export type ContactIconRegistryEntry = {
  pngFileName: string
  defaultLabel?: string
}

export const CONTACT_ICON_REGISTRY: Record<ContactPlatformKey, ContactIconRegistryEntry> = {
  email: { pngFileName: 'email.png' },
  website: { pngFileName: 'website.png' },
  location: { pngFileName: 'location.png' },
  link: { pngFileName: 'link.png' },
  instagram: { pngFileName: 'instagram.png', defaultLabel: 'Instagram' },
  facebook: { pngFileName: 'facebook.png', defaultLabel: 'Facebook' },
  youtube: { pngFileName: 'youtube.png', defaultLabel: 'YouTube' },
  tiktok: { pngFileName: 'tiktok.png', defaultLabel: 'TikTok' },
  x: { pngFileName: 'x.png', defaultLabel: 'X' },
  linkedin: { pngFileName: 'linkedin.png', defaultLabel: 'LinkedIn' },
  whatsapp: { pngFileName: 'whatsapp.png', defaultLabel: 'WhatsApp' },
  threads: { pngFileName: 'threads.png', defaultLabel: 'Threads' },
}

export function contactPlatformFromRegistry(key: ContactPlatformKey): ContactIconRegistryEntry {
  return CONTACT_ICON_REGISTRY[key]
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm vitest run src/lib/branding/contact-platform.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/branding/contact-platform.ts src/lib/branding/contact-platform.test.ts src/lib/branding/contact-icon-registry.ts
git commit -m "feat(branding): deteksi platform kontak dari URL"
```

---

### Task 2: Label resolver + icon URL helpers

**Files:**
- Create: `src/lib/branding/resolve-contact-display-label.ts`
- Create: `src/lib/branding/resolve-contact-display-label.test.ts`
- Create: `src/lib/branding/branding-icon-url.ts`
- Create: `src/lib/branding/branding-icon-url.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// resolve-contact-display-label.test.ts
import { describe, expect, it } from 'vitest'
import { resolveContactDisplayLabel } from './resolve-contact-display-label'

describe('resolveContactDisplayLabel', () => {
  it('prefers admin label', () => {
    expect(
      resolveContactDisplayLabel({
        label: 'IG Resmi',
        url: 'https://instagram.com/cisc',
        platform: 'instagram',
      }),
    ).toBe('IG Resmi')
  })
  it('uses registry default when label empty', () => {
    expect(
      resolveContactDisplayLabel({
        label: '',
        url: 'https://instagram.com/cisc',
        platform: 'instagram',
      }),
    ).toBe('Instagram')
  })
  it('uses hostname for unknown platform', () => {
    expect(
      resolveContactDisplayLabel({
        label: '',
        url: 'https://www.komunitas.example/path',
        platform: 'link',
      }),
    ).toBe('komunitas.example')
  })
})
```

```ts
// branding-icon-url.test.ts
import { describe, expect, it } from 'vitest'
import { brandingIconAbsoluteUrl, brandingIconPublicPath } from './branding-icon-url'

describe('brandingIconPublicPath', () => {
  it('returns path under branding-icons', () => {
    expect(brandingIconPublicPath('instagram')).toBe('/branding-icons/instagram.png')
  })
})

describe('brandingIconAbsoluteUrl', () => {
  it('builds absolute url', () => {
    expect(brandingIconAbsoluteUrl('email', 'https://app.example/')).toBe(
      'https://app.example/branding-icons/email.png',
    )
  })
  it('returns null without origin', () => {
    expect(brandingIconAbsoluteUrl('email', '')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm vitest run src/lib/branding/resolve-contact-display-label.test.ts src/lib/branding/branding-icon-url.test.ts
```

- [ ] **Step 3: Implement**

```ts
// resolve-contact-display-label.ts
import { contactPlatformFromRegistry } from '@/lib/branding/contact-icon-registry'
import type { ContactPlatformKey } from '@/lib/branding/contact-platform'
import { normalizeHostname } from '@/lib/branding/contact-platform'

export function resolveContactDisplayLabel(input: {
  label: string
  url: string
  platform: ContactPlatformKey
}): string {
  const trimmed = input.label.trim()
  if (trimmed) return trimmed

  const entry = contactPlatformFromRegistry(input.platform)
  if (input.platform !== 'link' && entry.defaultLabel) return entry.defaultLabel

  try {
    return normalizeHostname(new URL(input.url).hostname)
  } catch {
    return input.url.trim() || 'Tautan'
  }
}

export function websiteLinkLabel(): string {
  return 'Website'
}
```

```ts
// branding-icon-url.ts
import { contactPlatformFromRegistry } from '@/lib/branding/contact-icon-registry'
import type { ContactPlatformKey } from '@/lib/branding/contact-platform'

const ICON_BASE = '/branding-icons'

export function brandingIconPublicPath(platform: ContactPlatformKey): string {
  const file = contactPlatformFromRegistry(platform).pngFileName
  return `${ICON_BASE}/${file}`
}

export function brandingIconAbsoluteUrl(
  platform: ContactPlatformKey,
  appOrigin: string | undefined | null,
): string | null {
  const origin = appOrigin?.trim().replace(/\/$/, '')
  if (!origin) return null
  return new URL(brandingIconPublicPath(platform), origin).href
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm vitest run src/lib/branding/resolve-contact-display-label.test.ts src/lib/branding/branding-icon-url.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/branding/resolve-contact-display-label.ts src/lib/branding/resolve-contact-display-label.test.ts src/lib/branding/branding-icon-url.ts src/lib/branding/branding-icon-url.test.ts
git commit -m "feat(branding): label fallback dan URL ikon publik/absolut"
```

---

### Task 3: Asset PNG

**Files:**
- Create: `public/branding-icons/email.png` (dan 11 file lain)

- [ ] **Step 1: Add PNG files**

Buat 12 file PNG ~20×20px, warna abu gelap (`#64748b` atau selaras `--muted-foreground`), latar transparan:

`email.png`, `website.png`, `location.png`, `link.png`, `instagram.png`, `facebook.png`, `youtube.png`, `tiktok.png`, `x.png`, `linkedin.png`, `whatsapp.png`, `threads.png`

Sumber boleh: ekspor dari Figma, [Simple Icons](https://simpleicons.org/) monochrome, atau rasterisasi SVG sekali.

- [ ] **Step 2: Smoke-check di dev**

```bash
pnpm dev
```

Buka `http://localhost:3000/branding-icons/instagram.png` — harus 200.

- [ ] **Step 3: Commit**

```bash
git add public/branding-icons/
git commit -m "chore(branding): asset ikon kontak PNG"
```

---

### Task 4: `ContactIconRow` + footer publik

**Files:**
- Create: `src/components/branding/contact-icon-row.tsx`
- Modify: `src/components/branding/club-contact-display.tsx`

- [ ] **Step 1: Create `ContactIconRow`**

```tsx
// src/components/branding/contact-icon-row.tsx
import type { ReactNode } from 'react'

import type { ContactPlatformKey } from '@/lib/branding/contact-platform'
import { brandingIconPublicPath } from '@/lib/branding/branding-icon-url'
import { cn } from '@/lib/utils'

export function ContactIconRow(props: {
  platform: ContactPlatformKey
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-2', props.className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ikon statis kecil */}
      <img
        src={brandingIconPublicPath(props.platform)}
        alt=''
        aria-hidden
        width={20}
        height={20}
        className='mt-0.5 size-5 shrink-0'
      />
      <div className='min-w-0 flex-1'>{props.children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Refactor `ClubContactDisplay`**

Ganti isi kolom dengan `ContactIconRow`:

- Email: `platform='email'`, child = `<a href={mailto:…}>…</a>`
- Lokasi: `platform='location'`, child = `<p className='whitespace-pre-wrap'>…</p>`
- Website: `platform='website'`, label `websiteLinkLabel()`, `detectContactPlatform` tidak dipakai
- Tiap sosial: `platform={detectContactPlatform(url)}`, label `resolveContactDisplayLabel({ label, url, platform })`

Import dari `contact-platform`, `resolve-contact-display-label`, `contact-icon-row`.

- [ ] **Step 3: Manual check**

Footer publik di homepage (setelah isi branding di admin) menampilkan ikon di kiri teks.

- [ ] **Step 4: Commit**

```bash
git add src/components/branding/contact-icon-row.tsx src/components/branding/club-contact-display.tsx
git commit -m "feat(ui): ikon di footer kontak publik"
```

---

### Task 5: Footer email dengan `<Img>`

**Files:**
- Modify: `src/lib/email-templates/emails/club-email-contact-footer.tsx`
- Create: `src/lib/email-templates/emails/club-email-contact-footer.test.ts`
- Modify: `src/lib/email-templates/render-email-from-blocks.test.ts`

- [ ] **Step 1: Write failing email footer test**

```ts
// club-email-contact-footer.test.ts
import { describe, expect, it } from 'vitest'
import { render } from '@react-email/render'
import { createElement } from 'react'
import { ClubEmailContactFooter } from './club-email-contact-footer'

describe('ClubEmailContactFooter', () => {
  it('embeds absolute icon src for contact email', async () => {
    const html = await render(
      createElement(ClubEmailContactFooter, {
        clubNameNav: 'CISC',
        contactEmail: 'komite@example.com',
        websiteUrl: null,
        locationText: null,
        socialLinks: [],
        appOrigin: 'https://app.example',
      }),
    )
    expect(html).toContain('https://app.example/branding-icons/email.png')
    expect(html).toContain('komite@example.com')
  })
})
```

Extend props type `ClubEmailContactProps` + footer component dengan `appOrigin?: string | null` (pass dari `renderEmailFromBlocks` / layout dari `process.env.BETTER_AUTH_URL`).

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm vitest run src/lib/email-templates/emails/club-email-contact-footer.test.ts
```

- [ ] **Step 3: Implement icon rows in footer**

Helper internal `emailIconTextRow(iconUrl: string | null, child)`:

- Jika `iconUrl`: `Img` 16×16 inline + spacer + child
- Jika null: child saja (origin kosong)

Map kolom seperti web; website label `Website`; sosial pakai `detectContactPlatform` + `resolveContactDisplayLabel`.

Wire `appOrigin` dari `render-email-from-blocks.ts` → `club-email-layout.tsx` → `ClubEmailContactFooter`.

- [ ] **Step 4: Extend existing integration test**

Di `render-email-from-blocks.test.ts`, tambah:

```ts
expect(html).toContain('/branding-icons/email.png')
```

(set env `BETTER_AUTH_URL=https://test.example` di test setup atau pass contact + mock origin di render helper)

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/lib/email-templates/emails/club-email-contact-footer.test.ts src/lib/email-templates/render-email-from-blocks.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/email-templates/emails/club-email-contact-footer.tsx src/lib/email-templates/emails/club-email-contact-footer.test.ts src/lib/email-templates/render-email-from-blocks.ts src/lib/email-templates/render-email-from-blocks.test.ts
git commit -m "feat(email): ikon PNG di footer kontak transaksional"
```

---

### Task 6: Preview ikon di form admin

**Files:**
- Create: `src/components/admin/branding-field-icon-preview.tsx`
- Modify: `src/components/admin/club-branding-settings-form.tsx`

- [ ] **Step 1: Create preview component**

```tsx
'use client'

import type { ContactPlatformKey } from '@/lib/branding/contact-platform'
import { detectContactPlatform } from '@/lib/branding/contact-platform'
import { contactPlatformFromRegistry } from '@/lib/branding/contact-icon-registry'
import { brandingIconPublicPath } from '@/lib/branding/branding-icon-url'

export function BrandingFieldIconPreview(props: {
  platform: ContactPlatformKey
  hint?: string | null
}) {
  const entry = contactPlatformFromRegistry(props.platform)
  return (
    <div className='flex items-center gap-2 pt-1'>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brandingIconPublicPath(props.platform)} alt='' aria-hidden width={20} height={20} className='size-5 shrink-0' />
      {props.hint ? <p className='text-muted-foreground text-xs'>{props.hint}</p> : null}
    </div>
  )
}

export function socialIconHintFromUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed.startsWith('https://')) return null
  const platform = detectContactPlatform(trimmed)
  const label = contactPlatformFromRegistry(platform).defaultLabel
  if (!label) return null
  return `Terdeteksi: ${label}`
}
```

Export `fixedPlatform` helpers: `email` | `website` | `location` untuk field non-URL.

- [ ] **Step 2: Wire form**

Di `club-branding-settings-form.tsx`:

- Bawah `contactEmail` → `<BrandingFieldIconPreview platform='email' />`
- Bawah `websiteUrl` → `platform='website'`
- Bawah `locationText` → `platform='location'`
- Bawah setiap `socialUrl` → `platform={detect…}` + `hint={socialIconHintFromUrl(row.url)}`
- Ubah placeholder label sosial ke: `Opsional — kosongkan untuk nama platform otomatis`

- [ ] **Step 3: Manual check**

`/admin/settings/branding` — ketik URL Instagram, preview menampilkan ikon + "Terdeteksi: Instagram".

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/branding-field-icon-preview.tsx src/components/admin/club-branding-settings-form.tsx
git commit -m "feat(admin): preview ikon kontak di pengaturan branding"
```

---

### Task 7: Dokumentasi + verifikasi akhir

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Di **Key library modules**, tambah entri:

- `lib/branding/contact-platform.ts` — `detectContactPlatform`
- `lib/branding/contact-icon-registry.ts` — PNG + default label
- `lib/branding/resolve-contact-display-label.ts` — label tampilan sosial
- `lib/branding/branding-icon-url.ts` — path web + URL absolut email

Di **UI components**, tambah `contact-icon-row.tsx`; update baris `club-contact-display.tsx`.

Catat asset `public/branding-icons/`.

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
pnpm lint
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: ikon kontak branding di CLAUDE.md"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| ---------------- | ---- |
| PNG web + email | 3, 4, 5 |
| Deteksi hostname | 1 |
| Label fallback | 2, 4, 5 |
| Admin preview | 6 |
| No DB change | (none) |
| Plain text email tanpa ikon | tidak diubah (spec) |
| `BETTER_AUTH_URL` fallback | 5 |
| CLAUDE.md | 7 |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-branding-contact-icons-plan.md`.
