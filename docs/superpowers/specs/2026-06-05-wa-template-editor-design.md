---
title: Editor template WhatsApp — Tiptap, katalog variabel, halaman terpisah
date: 2026-06-05
project: match-screening
status: approved-in-chat
related:
  - 2026-05-02-admin-settings-modules-design.md
  - 2026-06-06-email-templates-and-blast-design.md
  - 2026-06-05-event-verification-comms-design.md
---

# Editor template WhatsApp

## Problem

- Template WA (7 jenis tetap) diedit inline di `/admin/settings/templates?tab=wa` dengan `<Textarea>` plain text — sulit memformat pesan WA dan tidak jelas variabel apa saja yang tersedia.
- Template Email digabung tab yang sama; Owner bingung navigasi dan scope fitur.
- Validasi hanya mengizinkan placeholder **wajib** — tidak ada variabel opsional dari konteks registrasi/acara.
- Metadata template (label, default body, token) tersebar di komponen panel; belum ada satu file katalog untuk seeder.

## Goal

1. **Halaman WA terpisah** dengan indeks (kartu/tabel seperti acara) + halaman edit per key.
2. **Editor Tiptap** dengan serializer WA Markdown; formatting penuh yang didukung WhatsApp (`*bold*`, `_italic_`, `~strike~`, monospace, list, blockquote).
3. **Dukungan variabel di editor** — chip inline, popover sisip, autocomplete `{`, checklist wajib, sidebar referensi.
4. **Katalog tunggal** `wa-template-catalog.ts` — defaults, metadata, token wajib/opsional; sumber seeder mendatang.
5. **Perluas variabel runtime** — render `wa.me` dan preview admin memakai konteks registrasi lengkap.
6. **Email dipindah saja** ke `/admin/settings/email-templates` (UI lama); peningkatan email **out of scope** fase ini.

## Locked product decisions

| Topic | Decision |
| ----- | -------- |
| Jumlah template | **7 enum `WaTemplateKey` tetap** — tidak ada halaman Buat / template custom |
| Penyimpanan DB | `ClubWaTemplate.body` tetap **string WA markdown** (bukan HTML) |
| Editor | **Tiptap** + round-trip serializer; Opsi HTML dual-storage **ditolak** |
| Variabel | **Wajib** (harus ≥1×) + **opsional** (boleh dipakai); token di luar katalog **ditolak** |
| Katalog | Satu file `lib/wa-templates/wa-template-catalog.ts` — label, deskripsi, kategori, sortOrder, defaultBody, requiredTokens, optionalTokens, tokenMeta |
| Seeder | Katalog = sumber kebenaran defaults; skrip seed **fase berikutnya** (dokumentasi di spec, tidak diimplementasi sekarang) |
| Email | Pindah ke `/admin/settings/email-templates`; panel textarea existing; **tanpa** Tiptap/list/card di fase ini |
| Akses | Owner-only (`guardOwner` / `canManageCommitteeAdvancedSettings`) — unchanged |
| Fallback runtime | Body DB invalid/kosong → fungsi `messages.ts` — unchanged |
| Bahasa UI | Indonesia |

---

## Routing & IA

### Sub-path canonik (revisi)

| Modul | Path |
| ----- | ---- |
| Template WhatsApp — indeks | `/admin/settings/templates/whatsapp` |
| Template WhatsApp — edit | `/admin/settings/templates/whatsapp/[key]/edit` |
| Template Email | `/admin/settings/templates/email` |
| Hub template pesan | `/admin/settings/templates` |

`[key]` = nilai string enum Prisma `WaTemplateKey`; nilai invalid → `notFound()`.

### Redirect (`next.config.ts`)

| Source | Destination |
| ------ | ----------- |
| `/admin/settings/templates?tab=wa` | `/admin/settings/whatsapp-templates` |
| `/admin/settings/templates?tab=email` | `/admin/settings/email-templates` |
| `/admin/settings/templates` | `/admin/settings` |
| `/admin/settings/whatsapp-templates` (redirect lama ke tab) | **dihapus** — path menjadi halaman nyata |

### Hub & sub-nav

- Hub `/admin/settings`: dua kartu terpisah — **Template WhatsApp** dan **Template Email** (ganti kartu tunggal "Template pesan").
- `committee-settings-subnav`: ganti item "Template pesan" → **Template WA** + **Template Email** (dua link).
- Hapus `SettingsTemplatesTabs` dan rute `/admin/settings/templates/page.tsx` setelah redirect aktif.

---

## Katalog template (`wa-template-catalog.ts`)

Struktur per `WaTemplateKey`:

```ts
type WaTemplateCatalogEntry = {
  labelId: string
  descriptionId: string
  category: 'pendaftaran' | 'verifikasi' | 'operasi'
  sortOrder: number
  defaultBody: string
  requiredTokens: readonly string[]
  optionalTokens: readonly string[]
  tokenMeta: Record<
    string,
    { labelId: string; descriptionId?: string; sampleValue: string }
  >
}
```

Export:

- `WA_TEMPLATE_CATALOG: Record<WaTemplateKey, WaTemplateCatalogEntry>`
- `WA_TEMPLATE_KEYS_ORDERED` — urutan tampilan indeks
- Helper: `getWaTemplateEntry(key)`, `allowedTokensForKey(key)`, `allTokensForKey(key)`

`CLUB_WA_DEFAULT_BODIES` dan label hardcoded di `club-wa-templates-panel.tsx` **dimigrasi** ke katalog; file lama re-export atau dihapus setelah migrasi.

### Kategori indeks

| Kategori | Template keys |
| -------- | ------------- |
| `pendaftaran` | `receipt` |
| `verifikasi` | `approved`, `rejected`, `payment_issue` |
| `operasi` | `cancelled`, `refunded`, `underpayment_invoice` |

### Token per template

| Key | Wajib | Opsional | Catatan sumber data |
| --- | ----- | -------- | ------------------- |
| `receipt` | `contact_name`, `event_title`, `registration_id`, `computed_total_idr` | `ticket_qty`, `ticket_category_name`, `contact_whatsapp`, `venue` | Registration + Event; receipt belum wired ke dialog admin — siapkan vars untuk konsistensi |
| `approved` | `event_title`, `venue`, `start_at_formatted` | `contact_name`, `registration_id`, `ticket_qty`, `ticket_category_name`, `open_gate_at_formatted` | Registration + Event (`kickOffAt`, `openGateAt`, venue) |
| `rejected` | `reason` | `contact_name`, `event_title`, `registration_id` | Alasan admin + Registration |
| `payment_issue` | `reason` | `contact_name`, `event_title`, `registration_id`, `computed_total_idr` | idem |
| `cancelled` | `contact_name`, `event_title` | `registration_id`, `ticket_qty` | Registration |
| `refunded` | `contact_name`, `event_title` | `registration_id`, `computed_total_idr` | Registration |
| `underpayment_invoice` | `contact_name`, `event_title`, `adjustment_amount_idr`, `bank_name`, `account_number`, `account_name` | `registration_id`, `computed_total_idr` | Registration + Event bank + adjustment |

### Validasi (`wa-template-policy.ts`)

1. Body tidak kosong setelah trim.
2. Setiap `requiredTokens` muncul ≥1× (scan `{token}`).
3. Setiap placeholder di body ∈ `requiredTokens ∪ optionalTokens`.
4. Placeholder tidak dikenal → `"Placeholder {x} tidak diperbolehkan untuk templat ini."`
5. Kurung `{}` sisa setelah substitusi preview → error (existing guard).

`REQUIRED_TOKENS` export dipertahankan sebagai alias `requiredTokens` dari katalog agar tes existing tidak pecah.

---

## Halaman indeks WA

Pola selaras `/admin/events` (tanpa paginasi — 7 baris).

### Query URL

| Param | Nilai | Default |
| ----- | ----- | ------- |
| `tab` | `all` \| `pendaftaran` \| `verifikasi` \| `operasi` | `all` (redirect kanonikal bila kosong) |
| `q` | teks cari label/deskripsi | — |
| `view` | kartu \| `tabel` | kartu |

Helper: `lib/admin/admin-wa-templates-list-url.ts` — `parseAdminWaTemplatesListParams`, `buildAdminWaTemplatesListUrl`.

### Header

Judul **Template WhatsApp** + deskripsi singkat (placeholder `{token}`, fallback bawaan).

### Toolbar

`AdminListToolbar`:

- Cari debounce → `q`
- `AdminFilterSelect` kategori → `tab`
- Toggle kartu/tabel → `view`

### Kartu

Label, badge kategori, cuplikan body (2 baris monospace), badge **Kustom** (ada baris DB) vs **Bawaan**, `updatedAt`, link **Edit**.

### Tabel

Kolom: Nama, Kategori, Status (Kustom/Bawaan), Diperbarui, Aksi (Edit).

Data: gabung katalog + `prisma.clubWaTemplate.findMany()` untuk body/updatedAt.

---

## Halaman edit WA

**Route:** `/admin/settings/whatsapp-templates/[key]/edit`

### Layout (desktop)

| Kolom kiri (~2/3) | Sidebar kanan (~1/3) |
| ----------------- | -------------------- |
| Breadcrumb + judul template | **Variabel tersedia** — daftar wajib/opsional + label + contoh |
| `WaTemplateEditor` | **Checklist wajib** — ✓/✗ real-time |
| Tombol Simpan + Reset ke bawaan | **Pratinjau WA** — `applyWaPlaceholders` dengan `sampleValue` |

Mobile: editor di atas, sidebar collapsible di bawah.

### Aksi

- **Simpan** — `saveClubWaTemplateBody` (existing); `revalidatePath` indeks + edit.
- **Reset** — `resetClubWaTemplateBody`; isi editor = `defaultBody` dari katalog (bukan hardcode panel).

---

## Editor Tiptap (`WaTemplateEditor`)

File: `src/components/ui/wa-template-editor.tsx`

### Format WA yang didukung

| WA syntax | Tiptap |
| --------- | ------ |
| `*tebal*` | Bold |
| `_miring_` | Italic |
| `~coret~` | Strike |
| `` `mono` `` | Code (inline) |
| `- item` / `* item` | BulletList |
| `1. item` | OrderedList |
| `> kutipan` | Blockquote |
| Baris kosong | Paragraph kosong |

Tidak didukung: heading, link, gambar, HTML block.

### Serializer

`lib/wa-templates/wa-markdown-serializer.ts`:

- `waMarkdownToDoc(markdown: string, catalogEntry): JSONContent`
- `docToWaMarkdown(doc: JSONContent): string`
- Round-trip test untuk formatting + placeholder chip

Placeholder plain `{token}` di markdown → **WaPlaceholderNode** di doc; sebaliknya saat serialize.

### WaPlaceholderNode (inline atom)

- Render: chip dengan **label Indonesia** (`tokenMeta.labelId`); subtitle monospace `{token}` opsional.
- Wajib vs opsional: gaya visual berbeda (solid vs outline).
- Token tidak ada di katalog template: chip merah + state invalid.
- Tidak bisa diedit parsial (atom); hapus = delete node utuh.
- Serialize: `{snake_case}` persis.

### Sisip variabel (3 jalur)

1. **Toolbar** — tombol `{x}` → Popover/Combobox: grup Wajib / Opsional, searchable, klik sisip chip di kursor.
2. **Autocomplete** — ketik `{` → suggest token allowed; Enter/pilih → chip.
3. **Sidebar** — klik baris variabel → sisip (sama dengan popover).

### Validasi client (non-blocking preview)

- Checklist wajib update on change.
- Simpan disabled bila token wajib belum lengkap **atau** ada chip invalid.
- Server tetap authoritative via `validateWaTemplateBody`.

---

## Runtime — variabel & render

### `wa-template-vars.ts`

```ts
buildWaTemplateVars(key: WaTemplateKey, ctx: WaTemplateRenderContext): Record<string, string>
```

`WaTemplateRenderContext` — struct flat berisi field yang dibutuhkan semua template (registration id, contact, event, bank, reason, adjustment, timestamps formatted id-ID `Asia/Jakarta`).

Perluas:

- `render-wa-from-db.ts` — terima context object, panggil `buildWaTemplateVars`.
- `build-registration-notify.ts` — perluas `RegistrationNotifyInput` / query halaman detail agar field opsional tersedia (ticket_qty, ticket_category_name, open_gate_at, dll.).

Formatting IDR: `formatWaIdr` (existing). Tanggal: pola `start_at_formatted` existing.

### Pratinjau admin (edit page)

Pakai `sampleValue` dari katalog — tidak perlu data DB nyata.

### Pratinjau dialog registrasi

Tetap `buildRegistrationWaNotify` — otomatis dapat vars lengkap setelah refactor.

---

## Email — scope minimal (pindah saja)

- Buat `app/admin/settings/email-templates/page.tsx` — render `ClubEmailTemplatesPanel` (komponen existing, tanpa perubahan UX).
- Metadata/load sama seperti halaman templates lama tab email.
- **Tidak** menambah indeks kartu/tabel, Tiptap, atau katalog email di fase ini.

---

## Error handling

| Kasus | Perilaku |
| ----- | -------- |
| Non-Owner | `notFound()` pada RSC; action → `Tidak diizinkan.` |
| Key invalid | `notFound()` |
| Validasi gagal | `ActionResult` field error `body` — Bahasa Indonesia |
| Body DB invalid saat render wa.me | Fallback `messages.ts` (existing) |
| Serializer gagal parse legacy body | Load sebagai plain text paragraphs; placeholder tetap `{token}` text |

---

## Testing (Vitest)

| Modul | Cakupan |
| ----- | ------- |
| `wa-template-catalog.ts` | Semua `defaultBody` lulus `validateWaTemplateBody`; keys = enum Prisma |
| `wa-template-policy.ts` | Required, optional allowed, unknown rejected |
| `wa-markdown-serializer.ts` | Round-trip bold/italic/strike/code/list/quote/placeholder; edge empty lines |
| `wa-template-vars.ts` | Mapping sample context → string values |
| `build-registration-notify.ts` | Regresi preview dengan token opsional di body |

---

## File map

| File | Tanggung jawab |
| ---- | -------------- |
| `lib/wa-templates/wa-template-catalog.ts` | **Baru** — katalog lengkap |
| `lib/wa-templates/wa-markdown-serializer.ts` | **Baru** — parse/serialize |
| `lib/wa-templates/wa-template-vars.ts` | **Baru** — build vars dari konteks |
| `lib/wa-templates/wa-template-policy.ts` | **Ubah** — required + allowed dari katalog |
| `lib/wa-templates/db-default-template-bodies.ts` | **Ubah/hapus** — re-export dari katalog |
| `lib/wa-templates/render-wa-from-db.ts` | **Ubah** — context + vars helper |
| `lib/wa-templates/build-registration-notify.ts` | **Ubah** — konteks diperluas |
| `components/ui/wa-template-editor.tsx` | **Baru** — Tiptap + chip + toolbar variabel |
| `components/admin/wa-templates/wa-templates-index-header.tsx` | **Baru** |
| `components/admin/wa-templates/wa-templates-index-toolbar.tsx` | **Baru** |
| `components/admin/wa-templates/wa-templates-cards-view.tsx` | **Baru** |
| `components/admin/wa-templates/wa-templates-table.tsx` | **Baru** |
| `components/admin/wa-templates/wa-template-edit-form.tsx` | **Baru** — client form + editor |
| `app/admin/settings/whatsapp-templates/page.tsx` | **Baru** — indeks RSC |
| `app/admin/settings/whatsapp-templates/[key]/edit/page.tsx` | **Baru** — edit RSC |
| `app/admin/settings/email-templates/page.tsx` | **Baru** — panel dipindah |
| `lib/admin/admin-wa-templates-list-url.ts` | **Baru** |
| `app/admin/settings/templates/page.tsx` | **Hapus** setelah redirect |
| `components/admin/settings-templates-tabs.tsx` | **Hapus** |
| `components/admin/club-wa-templates-panel.tsx` | **Hapus** setelah migrasi |
| `next.config.ts` | Redirect diperbarui |
| `committee-settings-subnav.tsx` | Dua item WA + Email |
| `app/admin/settings/page.tsx` | Dua kartu |
| `CLAUDE.md` | Route layout + lib modules |

---

## Out of scope

- Seeder CLI / `prisma db seed` entry
- Template WA custom (di luar enum)
- Editor Tiptap untuk email
- Indeks kartu/tabel email
- Pengiriman WA otomatis (tetap manual wa.me)
- i18n multi-bahasa

---

## Success criteria

- Owner membuka `/admin/settings/whatsapp-templates`, melihat 7 template dalam kartu atau tabel, filter/cari berfungsi.
- Owner membuka edit, memformat pesan dengan toolbar WA, menyisip variabel via chip/popover/autocomplete, melihat checklist wajib + pratinjau.
- Simpan valid → DB + toast sukses; invalid → error Indonesia.
- Reset → body = default katalog.
- Dialog wa.me di detail registrasi render token opsional bila Owner menambahkannya ke template.
- Email accessible di `/admin/settings/email-templates` dengan UX unchanged.
- URL lama `/admin/settings/templates?tab=*` redirect benar.
