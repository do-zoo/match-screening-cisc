---
title: Layout email terstruktur + branding kontak terpadu
date: 2026-06-05
project: match-screening
status: approved
related:
  - 2026-06-05-email-template-editor-design.md
  - 2026-06-06-email-templates-and-blast-design.md
  - 2026-04-30-nobar-cisc-tangsel-ui-ux-design-system-design.md
source_reference: email-layout-for-cisc (Downloads) — struktur, bukan palette emerald/dark
---

# Layout email terstruktur + branding kontak terpadu

## Problem

- Layout email transaksional saat ini **terang minimal** (zinc putih, CTA hitam) dan tidak selaras dengan pola layout proyek referensi `email-layout-for-cisc` (header/footer kaya, kartu section, CTA menonjol).
- Footer kontak hanya lewat `footerPlainText` (textarea bebas) — tidak terstruktur, tidak bisa dipakai konsisten di email maupun situs publik.
- Blok `branding_header` di editor menduplikasi tanggung jawab yang seharusnya global dari `ClubBranding`.
- Proyek referensi memakai Tailwind/grid/Lucide yang **tidak aman** untuk klien email; adaptasi harus lewat React Email + inline styles.

## Goal

1. **Perluas `ClubBranding`** dengan kontak terstruktur (email, website, lokasi, ≤3 sosial).
2. **Sinkronkan footer publik dan email** dari sumber data yang sama (ganti `footerPlainText`).
3. **Refresh shell email** — terang, struktur mirip Downloads, **warna design system match-screening** (`:root` light primary biru).
4. **Perbaiki styling blok** (kartu ringkasan, CTA primary, border aksen section).
5. **Kurangi kebingungan editor** — header global otomatis; `branding_header` di-skip/dihapus dari default & migrasi body.

## Locked product decisions (brainstorming 2026-06-05)

| Topic | Decision |
| ----- | -------- |
| Visual email | **B** — tema **terang**; struktur Downloads; warna **bukan** emerald/dark referensi |
| Footer data | Perluas Pengaturan Branding: `contactEmail`, `websiteUrl`, `locationText`, `socialLinks` (max 3 `{ label, url }`) |
| Footer publik | **A** — layout terstruktur **sama** dengan email; **hapus** `footerPlainText` |
| Implementasi | **Satu rilis terintegrasi** (schema + admin + public footer + email shell) |
| `branding_header` blok | Skip saat render; hapus dari default katalog; strip dari JSON tersimpan saat load/migrasi |
| `footer_disclaimer` blok | **Tetap** editable per template, di bawah footer kontak otomatis |
| Email tech | `@react-email/components`, inline styles, tabel untuk footer 3 kolom (kompatibilitas klien) |
| Token warna | File `email-design-tokens.ts` — hex eksplisit, selaras `:root` light di `globals.css` |
| Akses mutasi branding | Owner-only + `appendClubAuditLog` (unchanged) |
| Bahasa UI / error | Indonesia |

## Out of scope (v1)

- Tema gelap email
- Ikon/gambar di footer email (hanya teks + link)
- Tagline header terpisah (header = logo + `clubNameNav` saja)
- Field branding di luar set C (mis. WhatsApp khusus)
- Drag-and-drop blok editor

---

## Data model

### `ClubBranding` (Prisma)

| Field | Type | Validation |
| ----- | ---- | ---------- |
| `clubNameNav` | `String` | required, max 120 (unchanged) |
| `logoBlobUrl` / `logoBlobPath` | `String?` | unchanged |
| `contactEmail` | `String?` | optional; `normalizeStoredEmail` / Zod email |
| `websiteUrl` | `String?` | optional; must start with `https://` if set |
| `locationText` | `String?` | optional; max 200 chars |
| `socialLinks` | `Json?` | optional; array 0–3 of `{ label: string, url: string }`; label max 40; url https |
| ~~`footerPlainText`~~ | — | **removed** |

### Migration SQL (order)

1. Add nullable columns `contact_email`, `website_url`, `location_text`, `social_links`.
2. Data migration: `UPDATE "ClubBranding" SET location_text = footer_plain_text WHERE footer_plain_text IS NOT NULL AND TRIM(footer_plain_text) <> '' AND (location_text IS NULL OR TRIM(location_text) = '');`
3. Drop column `footer_plain_text`.

### `PublicClubBrandingVm` / loaders

Extend `loadPublicClubBranding` (and admin branding page loader) to expose new fields. Type:

```ts
type ClubSocialLink = { label: string; url: string }

export type PublicClubBrandingVm = {
  clubNameNav: string
  logoBlobUrl: string | null
  contactEmail: string | null
  websiteUrl: string | null
  locationText: string | null
  socialLinks: ClubSocialLink[]
}
```

Empty `socialLinks` = `[]`. Parse `socialLinks` JSON with Zod on read; invalid stored JSON → `[]` (defensive).

---

## Admin — Pengaturan Branding

Path: `/admin/settings/branding` (unchanged).

### Form sections

1. **Identitas** — `clubNameNav`, logo upload (unchanged behavior).
2. **Kontak & footer** — `contactEmail`, `websiteUrl`, `locationText`, dynamic list sosial (max 3 rows: label + URL).

### Server action

- `saveClubBranding` — parse with extended `clubBrandingTextsSchema` (+ social array from `FormData` or JSON field).
- Audit `metadata.changed` lists new field keys when modified.
- `revalidatePath` untuk `/`, `/events`, branding page, dan path template email jika perlu pratinjau.

### UX notes

- Semua kontak opsional; helper text: dipakai di footer situs publik dan semua email transaksional.
- URL sosial dan website: placeholder `https://…`
- Hapus textarea `footerPlainText`.

---

## Komponen bersama — kontak

### `ClubContactDisplay` (web)

- Path: `src/components/branding/club-contact-display.tsx` (or `src/components/public/club-contact-footer.tsx`).
- Props: `PublicClubBrandingVm` contact subset.
- Layout: 3-column on `md+`, stack on mobile; hide empty columns.
- Styles: `text-muted-foreground`, links `text-primary hover:underline`, `border-t`, padding selaras `PublicFooter` saat ini.

### `PublicFooter`

- Replace plain text wrapper with `ClubContactDisplay`.
- If **all** contact fields empty and no social links → return `null` (no footer), same as empty `footerPlainText` today.

---

## Email design tokens

File: `src/lib/email-templates/email-design-tokens.ts`

Constants (hex, documented as approximations of `:root` light in `globals.css`):

| Token | Usage | Value (v1 locked) |
| ----- | ----- | ----------------- |
| `emailPageBg` | outer `Body` | `#f4f4f5` |
| `emailCardBg` | main card | `#ffffff` |
| `emailCardBorder` | card border | `#e4e4e7` |
| `emailText` | body | `#18181b` |
| `emailTextMuted` | secondary | `#71717a` |
| `emailPrimary` | CTA, links, accents | `#1e3a8a` (primary-800 family) |
| `emailPrimaryForeground` | CTA text | `#ffffff` |
| `emailHeaderBand` | header background | `#eff6ff` (primary-50 family) |
| `emailSurfaceMuted` | invoice summary box | `#f4f4f5` |
| `emailSurfaceSuccess` | registration receipt | `#ecfdf5` / border `#a7f3d0` (keep semantic green) |

Adjust only via this file — not scattered magic strings.

---

## Email shell architecture

### `ClubEmailLayout`

Props extend to:

```ts
{
  preview: string
  clubNameNav: string
  logoBlobUrl?: string | null
  contact: Pick<PublicClubBrandingVm, 'contactEmail' | 'websiteUrl' | 'locationText' | 'socialLinks'>
  children: ReactNode
}
```

Structure (React Email):

1. **Header band** — `emailHeaderBand`, bottom border; optional `Img` logo; `Text` club name (18–20px semibold).
2. **Content** — `{children}` (blocks).
3. **Contact footer** — table-based 3 columns (Email | Lokasi | Sosial); omit empty cells/columns; links `mailto:` / `https`.
4. No duplicate branding inside children.

### `renderEmailFromBlocks`

- Load branding once (caller may pass or loader fetches).
- Pass branding into `ClubEmailLayout`.
- `renderEmailBlocks`: **skip** `case 'branding_header'` (no output).
- `blocksToPlainText`: append contact block after body blocks, before/after disclaimer per logical order: body → contact lines → disclaimer.

### Plain-text contact appendix

Example lines when fields set:

```
---
Email: x@y.com
Website: https://…
Lokasi: …
Instagram: https://…
```

---

## Block styling updates (`club-email-blocks.tsx`)

| Block | Change |
| ----- | ------ |
| `paragraph` | unchanged structure; optional slightly increased line-height |
| `invoice_summary` | use `emailSurfaceMuted` tokens |
| `registration_receipt` | keep success surface tokens |
| `bank_details` | left border `emailPrimary` (not `#18181b`) |
| `cta_button` | `backgroundColor: emailPrimary`, `color: emailPrimaryForeground` |
| `footer_disclaimer` | muted text, centered, top border above disclaimer only if contact footer rendered |

### Body stored template migration

In `load-club-email-templates.ts` or dedicated `migrate-email-blocks.ts`:

- Filter out blocks where `type === 'branding_header'`.
- Run on parse and on save preview (idempotent).

Update `email-template-catalog.ts` default blocks: **remove** `branding_header` entry from all keys.

### Editor UI

- Remove `branding_header` from add-block checklist / sidebar.
- Help text: header dan footer kontak dari Pengaturan → Branding.
- Preview panel unchanged iframe pattern; branding contact visible when fields filled.

---

## Files to create / modify (implementation hint)

| Area | Files |
| ---- | ----- |
| Prisma | `schema.prisma`, new migration |
| Branding | `club-branding-schema.ts`, `admin-club-branding.ts`, `club-branding-settings-form.tsx`, `load-club-branding.ts` |
| Public | `public-footer.tsx`, new `club-contact-display.tsx` |
| Email | `email-design-tokens.ts`, `club-email-layout.tsx`, `club-email-blocks.tsx`, `render-email-from-blocks.ts`, `load-club-email-templates.ts`, `email-template-catalog.ts` |
| Tests | schema parse, block migration, `renderEmailFromBlocks` HTML contains contact |
| Docs | `CLAUDE.md` — ClubBranding fields, new modules |

---

## Error handling

- Invalid social JSON in DB → treat as `[]`, no throw on public pages.
- Save branding: Zod field errors Indonesian; https enforcement on URLs.
- Email render without branding row → empty contact footer section (only disclaimer + content).

---

## Testing

1. **Unit** — `clubBrandingTextsSchema` (email, https, max 3 social, label length).
2. **Unit** — strip `branding_header` from blocks array.
3. **Unit** — `blocksToPlainText` includes contact lines when vars/branding passed.
4. **Render smoke** — `renderEmailFromBlocks` output contains `contactEmail` when set.
5. **Manual** — Branding form save; public homepage footer; admin email preview iframe (Gmail-like width 600px).

---

## Acceptance criteria

- [ ] Owner dapat mengisi kontak + ≤3 sosial di Branding; audit log mencatat perubahan.
- [ ] Footer publik menampilkan layout 3 kolom bila ada data; hidden bila semua kosong.
- [ ] Email transaksional memakai header band + footer kontak yang sama (logo, nama, field branding).
- [ ] CTA email memakai primary biru, bukan hitam zinc.
- [ ] Template tersimpan tanpa `branding_header` tidak menampilkan header ganda.
- [ ] `footer_disclaimer` masih editable dan muncul di bawah footer kontak.
- [ ] Migrasi: teks `footerPlainText` lama masuk `locationText` bila lokasi kosong.
- [ ] `CLAUDE.md` diperbarui.

---

## Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Email clients ignore table layout | Test footer with single-column fallback rows on narrow (stack rows in table) |
| Broken https links | Zod + normalize on save |
| Legacy templates with only `branding_header` | Strip on load; content blocks remain |

---

## Related follow-up (not v1)

- Optional `clubTagline` field for header subtitle
- Dark-mode email variant for marketing only
