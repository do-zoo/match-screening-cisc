---
title: Editor template email — blok terstruktur + React Email + Tiptap
date: 2026-06-05
project: match-screening
status: approved
related:
  - 2026-06-05-wa-template-editor-design.md
  - 2026-06-06-email-templates-and-blast-design.md
---

# Editor template email

## Problem

- Template email (`invoice_underpayment`, `magic_link`) masih diedit sebagai **plain text** (`subject` + `body` textarea) di satu halaman inline.
- Pengiriman invoice memakai HTML minimal (`pre-wrap` + `<br>`), bukan layout React Email yang konsisten dengan auth email.
- Magic link memisahkan body DB (teks) dan layout HTML hardcoded di `MagicLinkEmail` — sulit dipreview utuh di admin.
- Owner tidak bisa menyusun ulang section email tanpa deploy kode; tidak ada pratinjau HTML yang akurat.

## Goal

1. **Editor blok terstruktur (opsi B)** untuk **kedua** template email.
2. **Render runtime** dan **pratinjau admin** dari susunan blok via **React Email**.
3. **Paragraf editable** memakai **Tiptap** (placeholder inline, formatting terbatas yang aman untuk klien email).
4. **IA** selaras editor WA: indeks + halaman edit per `EmailTemplateKey`.
5. **Migrasi** body plain text lama → susunan blok default tanpa migrasi Prisma.

## Locked product decisions

| Topic | Decision |
| ----- | -------- |
| Model editor | **B — blok terstruktur** untuk `invoice_underpayment` **dan** `magic_link` |
| Penyimpanan | Kolom `ClubEmailTemplate.body` = JSON string `{"v":1,"blocks":[...]}` (pendekatan 1 — tanpa kolom baru) |
| Paragraf | **Tiptap** per blok `paragraph`; subjek tetap `<Input>` satu baris |
| Blok non-paragraf | Label CTA (`cta_button`) dan teks `footer_disclaimer` = **Input** satu baris (bukan Tiptap) |
| Render | `@react-email/components` + `render` dari `lib/email-templates/render-email-from-blocks.ts` |
| Template count | Tetap **2 enum** — tidak ada template custom |
| Urutan blok | Tombol **↑ / ↓** di v1 (tanpa drag-and-drop) |
| Placeholder | `{snake_case}` — chip inline (extension mirip WA); validasi token wajib/opsional per katalog |
| Formatting Tiptap | **Bold**, **italic**, **link** (`https` / `mailto` saja), **bullet list**, **ordered list** — tanpa heading, code block, strike, blockquote, gambar |
| Plain text email | Turunan otomatis dari doc Tiptap (strip formatting) untuk field Resend `text` |
| Akses | Owner-only (`guardOwner`, `canManageCommitteeAdvancedSettings`) |
| Audit | `appendClubAuditLog` pada save/reset — unchanged |
| OTP 2FA | Tetap hardcoded — bukan `ClubEmailTemplate` |
| Bahasa UI | Indonesia |
| Fallback runtime | Parse/validasi gagal → blok default dari katalog |

---

## Routing & IA

| Halaman | Path |
| ------- | ---- |
| Indeks | `/admin/settings/templates/email` |
| Edit | `/admin/settings/templates/email/[key]/edit` |

`[key]` = nilai `EmailTemplateKey`; invalid → `notFound()`.

- Ganti `ClubEmailTemplatesPanel` (dua kartu inline) dengan indeks tabel/kartu + link Edit (pola `wa-templates-index-*`).
- Breadcrumb: `Pengaturan / Template pesan / Email / {label}`.

---

## Katalog (`email-template-catalog.ts`)

Struktur per `EmailTemplateKey` (mirror pola WA):

```ts
type EmailTemplateCatalogEntry = {
  labelId: string
  descriptionId: string
  sortOrder: number
  defaultSubject: string
  defaultBlocks: EmailBlock[]
  requiredTokens: readonly string[]
  optionalTokens: readonly string[]
  tokenMeta: Record<string, { labelId: string; descriptionId?: string; sampleValue: string }>
}
```

Export: `EMAIL_TEMPLATE_CATALOG`, `EMAIL_TEMPLATE_KEYS_ORDERED`, `getEmailTemplateEntry`, `allowedTokensForKey`, `allTokensForKey`.

`CLUB_EMAIL_DEFAULT_BODIES` → migrasi isi ke `defaultBlocks` + `defaultSubject`; file lama re-export atau hapus setelah migrasi.

### Tipe blok (`EmailBlock` discriminated union)

| `type` | Invoice | Magic link | Konten Owner |
| ------ | ------- | ---------- | ------------ |
| `branding_header` | ✓ | ✓ | — (nama klub dari `ClubBranding.clubNameNav`) |
| `paragraph` | ✓ (≥1, bisa tambah) | ✓ (≥1) | **Tiptap doc JSON** + placeholder |
| `invoice_summary` | ✓ | — | — (menampilkan `{event_title}`, `{adjustment_amount_idr}`) |
| `bank_details` | ✓ | — | — (menampilkan `{bank_name}`, `{account_number}`, `{account_name}`) |
| `cta_button` | — | ✓ | `label` string (Input), URL dari runtime `{magic_link_url}` |
| `footer_disclaimer` | opsional | ✓ | `text` string (Input) atau dihapus dari susunan |

**Aturan susunan:**

- Blok sistem (`branding_header`, `invoice_summary`, `bank_details`, `cta_button`) **tidak dapat dihapus**; hanya diurutkan relatif terhadap paragraf sesuai aturan template (lihat default order di katalog).
- Blok `paragraph` dapat **ditambah**, **dihapus** (min 1), diurutkan dengan ↑↓.
- `cta_button` tepat satu pada magic link.

### Token

| Key | Wajib | Opsional | Catatan |
| --- | ----- | -------- | ------- |
| `invoice_underpayment` | `contact_name`, `event_title`, `adjustment_amount_idr`, `bank_name`, `account_number`, `account_name` | `registration_id` | Token bank boleh hanya di render blok `bank_details`; paragraf harus memuat token wajib yang bukan hanya di blok sistem — validasi mengagregasi **subjek + semua doc Tiptap** |
| `magic_link` | — (URL di CTA, bukan di Tiptap) | `club_name_nav` | Subjek tidak kosong; minimal satu paragraf; `magic_link_url` **hanya** di-inject ke `cta_button` saat render |

---

## Penyimpanan & migrasi

### Format `body` di DB

```ts
type StoredEmailTemplateBody = {
  v: 1
  blocks: EmailBlock[]
}

type ParagraphBlock = {
  type: 'paragraph'
  id: string // cuid atau uuid untuk key stabil di UI
  doc: JSONContent // Tiptap document
}

type CtaButtonBlock = {
  type: 'cta_button'
  label: string
}

type FooterDisclaimerBlock = {
  type: 'footer_disclaimer'
  text: string
}

// branding_header | invoice_summary | bank_details: { type, id? }
```

### Migrasi plain text lama

Fungsi `migratePlainBodyToBlocks(key, legacyBody: string): EmailBlock[]`:

1. Split baris kosong → paragraf terpisah.
2. Tiap paragraf → `paragraph` dengan `doc` dari `plainTextToEmailDoc(text)` (satu `paragraph` node, teks + placeholder regex → chip).
3. Sisipkan blok sistem default dari katalog di posisi kanonik.

Pada **load** (`loadClubEmailTemplates`): jika `body` tidak parse sebagai `{ v: 1, blocks }`, jalankan migrasi di memori (opsional: tulis balik ke DB pada save berikutnya).

Pada **save**: selalu persist JSON v1; tolak body plain.

---

## Tiptap (`EmailParagraphEditor`)

Komponen klien: `components/ui/email-paragraph-editor.tsx` (atau `email-template-paragraph-editor.tsx`).

**Extensions:**

- `StarterKit` dikonfigurasi: **disable** `heading`, `codeBlock`, `code`, `blockquote`, `horizontalRule`, `strike` (atau setara).
- **Enable:** `bold`, `italic`, `bulletList`, `orderedList`, `paragraph`, `hardBreak`, `history`.
- `Link` — `openOnClick: false`; validasi href: `https://`, `mailto:` saja.
- `Placeholder` — teks Indonesia per konteks.
- `EmailPlaceholder` — fork dari `wa-placeholder-extension` (nama node `emailPlaceholder`, command `insertEmailPlaceholder`).

**Toolbar:** Bold, Italic, Link, Bullet list, Ordered list, Sisip variabel (Popover daftar token dari katalog), Undo/Redo.

**Serializers** (`lib/email-templates/email-doc-serializer.ts`):

- `emailDocToPlainText(doc, vars)` — untuk Resend `text` + validasi placeholder.
- `emailDocToReactNodes(doc, vars)` — AST intermediate → komponen React Email (`Text`, `Link`, list sebagai beberapa `Text` dengan bullet/numbering inline style).
- `plainTextToEmailDoc(text)` — migrasi.
- `collectTokensFromDoc(doc)` — untuk checklist UI.

**Validasi** (`email-template-editor-validation.ts`):

- `missingRequired`, `invalidTokens` — pola sama WA.
- Link tidak valid → error Indonesia.

Tidak memakai serializer WA Markdown — format penyimpanan email adalah **Tiptap JSON di dalam blok**, bukan string markdown.

---

## Render runtime

```
loadClubEmailTemplates()
  → parse body (atau migrate)
renderEmailFromBlocks({ key, subject, blocks, vars })
  → { subject, text, html }
```

- `html` = `render()` dari komponen React Email `ClubEmailLayout` + mapper blok.
- `text` = gabungan plain dari semua blok.
- **Invoice** (`send-invoice-email.ts`): ganti wrapper HTML sederhana dengan `html` dari renderer.
- **Magic link** (`auth.ts`): `resolveMagicLinkEmailContent` diganti/diperluas memakai blok; hapus parsing `introText` dari baris body; satu sumber kebenaran.

Komponen React Email baru di `src/lib/email-templates/emails/`:

- `club-email-layout.tsx` — wrapper (background, container, max-width 480px).
- `invoice-underpayment-email.tsx` — tidak wajib terpisah jika generic mapper blok cukup.

Branding header memuat `clubNameNav` dari `loadPublicClubBranding()`.

---

## UI halaman edit

Layout 2 kolom (lg), pola `WaTemplateEditForm`:

| Kiri | Kanan |
| ---- | ----- |
| Badge Kustom/Bawaan | Kartu variabel (klik sisip ke editor fokus) |
| Input subjek | Checklist token wajib |
| Daftar kartu blok | Pratinjau email (HTML iframe atau `dangerouslySetInnerHTML` dari server action) |
| Kartu `paragraph`: `EmailParagraphEditor` | |
| Kartu `cta_button` / `footer`: Input | |
| Blok sistem: label readonly + ↑↓ jika diizinkan | |
| + Tambah paragraf | |
| Simpan / Reset | |

**Pratinjau:** server action `previewClubEmailTemplate(key, subject, blocksJson)` → `guardOwner` → `{ html, text }` dengan `sampleVarsFromCatalog(entry)`.

Debounce pratinjau ~300ms di klien (transisi `useTransition`).

---

## Server actions

| Action | Perubahan |
| ------ | --------- |
| `saveClubEmailTemplate` | Validasi JSON v1 + `validateEmailTemplateBlocks(key, subject, blocks)` |
| `resetClubEmailTemplate` | Unchanged semantics |
| `previewClubEmailTemplate` | **Baru** — read-only render |

Schema Zod: `saveClubEmailTemplateFormSchema` — `body` min length, parse JSON, refine blocks shape.

Audit actions: unchanged (`CLUB_EMAIL_TEMPLATE_SAVED`, `RESET`).

`revalidatePath`: `/admin/settings/templates/email`, `/admin/settings/templates/email/[key]/edit`.

---

## Testing

| Area | File |
| ---- | ---- |
| Migrasi plain → blocks | `migrate-plain-email-body.test.ts` |
| Doc serializer + tokens | `email-doc-serializer.test.ts` |
| Validasi blok | `email-template-editor-validation.test.ts` |
| Render HTML snapshot ringkas | `render-email-from-blocks.test.ts` |
| Policy token wajib | perluas `email-template-policy.test.ts` |

---

## Out of scope v1

- Drag-and-drop blok
- Kolom Prisma `bodyBlocks` terpisah
- Tiptap pada subjek atau label CTA (tetap Input)
- Gambar, warna kustom, font picker
- Template email baru di luar enum
- Rich HTML bebas / paste dari Word
- Editor OTP / admin invite (tetap komponen auth terpisah)

---

## Dokumentasi & CLAUDE.md

Setelah implementasi, perbarui `CLAUDE.md`:

- Route: `/admin/settings/templates/email/[key]/edit`
- Modul: `email-template-catalog.ts`, `email-doc-serializer.ts`, `render-email-from-blocks.ts`, `EmailParagraphEditor`

---

## Urutan implementasi (untuk rencana)

1. Katalog + tipe blok + migrasi plain text
2. Serializer Tiptap ↔ plain/React Email
3. `renderEmailFromBlocks` + ubah invoice + magic link runtime
4. Server actions + validasi
5. UI indeks + halaman edit + `EmailParagraphEditor`
6. Pratinjau server action
7. Hapus panel lama; tes
