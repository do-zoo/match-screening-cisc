---
title: Ikon kontak branding (publik, admin, email)
date: 2026-06-05
project: match-screening
status: approved
supersedes_out_of_scope:
  - 2026-06-05-email-layout-branding-design.md — "Ikon/gambar di footer email (hanya teks + link)"
related:
  - 2026-06-05-email-layout-branding-design.md
  - 2026-04-30-nobar-cisc-tangsel-ui-ux-design-system-design.md
---

# Ikon kontak branding (publik, admin, email)

## Problem

Footer kontak (`ClubContactDisplay`, `ClubEmailContactFooter`, form Pengaturan Branding) sudah terstruktur (email, website, lokasi, ≤3 sosial) tetapi **hanya teks + link**. Admin mengisi label sosial manual; tampilan kurang mudah dipindai dan tidak memanfaatkan platform dari URL. Spec layout email v1 sengaja mengecualikan ikon di email; produk sekarang meminta **ikon di semua permukaan** dengan konsistensi visual.

## Goal

1. Menampilkan **ikon PNG kecil** di samping setiap baris kontak di footer publik dan footer email transaksional.
2. **Deteksi platform sosial** dari hostname URL; label tampilan tetap bisa dikustom admin dengan fallback otomatis.
3. **Preview ikon live** di form admin saat mengisi URL / melihat field kontak tetap.
4. **Tanpa perubahan schema Prisma** — tetap `contactEmail`, `websiteUrl`, `locationText`, `socialLinks: { label, url }[]`.

## Locked product decisions (brainstorming)

| Topic | Decision |
| ----- | -------- |
| Cakupan | **D** — footer publik, form admin, footer email |
| Sosial | **C** — deteksi platform dari hostname URL |
| Email | **B** — ikon sebagai **PNG kecil di-host** (`public/`), URL absolut di render email |
| Pendekatan teknis | **Satu paket PNG** dipakai web + email (bukan Lucide di web + PNG di email) |
| Schema DB | Tidak berubah |
| Bahasa UI / error | Indonesia (unchanged) |
| Mutasi branding | Owner-only + audit (unchanged) |

## Out of scope (v1)

- Ikon di header email / logo klub (hanya baris kontak footer)
- Upload ikon custom per klub
- Field WhatsApp terpisah di branding (bukan lewat URL sosial)
- Animasi atau ikon interaktif
- Tema gelap khusus ikon
- Penyimpanan `platform` terdenormalisasi di DB

---

## Architecture

### Shared modules

| File | Responsibility |
| ---- | ---------------- |
| `lib/branding/contact-platform.ts` | `detectContactPlatform(url)` → `ContactPlatformKey`; normalisasi hostname |
| `lib/branding/contact-icon-registry.ts` | Map key → `{ pngFileName, defaultLabelId }` |
| `lib/branding/resolve-contact-display-label.ts` | Label tampilan: admin label → default platform (ID) → hostname |
| `lib/branding/branding-icon-url.ts` | `brandingIconPublicPath(key)`, `brandingIconAbsoluteUrl(key, appOrigin)` untuk email |

`ContactPlatformKey` (awal):

- Tetap: `email`, `website`, `location`
- Sosial (hostname): `instagram`, `facebook`, `youtube`, `tiktok`, `x`, `linkedin`, `whatsapp`, `threads`
- Fallback: `link`

### Hostname rules (contoh)

| Hostname patterns | Key |
| ----------------- | --- |
| `instagram.com` | `instagram` |
| `facebook.com`, `fb.com`, `m.facebook.com` | `facebook` |
| `youtube.com`, `youtu.be` | `youtube` |
| `tiktok.com` | `tiktok` |
| `twitter.com`, `x.com` | `x` |
| `linkedin.com` | `linkedin` |
| `whatsapp.com`, `wa.me` | `whatsapp` |
| `threads.net` | `threads` |
| lainnya | `link` |

Parsing: `new URL(url)`; bandingkan `hostname` tanpa `www.`; gagal parse → `link`.

### Label tampilan

```ts
resolveContactDisplayLabel({
  label: string,      // dari admin / DB
  url: string,        // untuk sosial
  platform: ContactPlatformKey,
}): string
```

1. `label.trim()` non-empty → pakai label.
2. Platform dikenali (bukan `link`) → label default Indonesia dari registry (`Instagram`, `YouTube`, …).
3. Else → hostname dari URL tanpa `www.`; untuk `website` tetap teks **Website**; untuk `email`/`location` tidak pakai fungsi ini (nilai mentah field).

Website: teks link tetap **Website** (bukan hostname), kecuali produk memutuskan lain — **locked: tetap "Website"**.

### Static assets

Folder: `public/branding-icons/`

| File | Dipakai untuk |
| ---- | ------------- |
| `email.png` | `contactEmail` |
| `website.png` | `websiteUrl` |
| `location.png` | `locationText` |
| `link.png` | sosial tidak dikenali |
| `instagram.png`, `facebook.png`, … | platform terdeteksi |

Spesifikasi: ~20×20px, warna netral selaras `--muted-foreground` / `EMAIL_DESIGN_TOKENS.footerText`, PNG (atau WebP jika semua konsumen mendukung — **default PNG** untuk email).

Email membutuhkan URL absolut: `brandingIconAbsoluteUrl(key, process.env.BETTER_AUTH_URL)` — gagal jika origin kosong saat render (sama pola asset email lain).

---

## UI components

### `ContactIconRow` (baru, `components/branding/contact-icon-row.tsx`)

Props: `platform: ContactPlatformKey`, `children` (teks/link), optional `className`.

- Web: `<img src={brandingIconPublicPath(platform)} alt="" aria-hidden width={20} height={20} className="shrink-0" />`
- Bukan `next/image` wajib (ikon kecil statis); boleh `next/image` jika sudah dipakai di footer.

### `ClubContactDisplay` (refactor)

- Pertahankan grid 3 kolom desktop: Email | Lokasi | Sosial Media.
- Isi kolom: daftar `ContactIconRow` per baris.
- Email: ikon `email` + `mailto:` link.
- Lokasi: ikon `location` + teks `whitespace-pre-wrap` (bukan link).
- Sosial: website + tiap `socialLinks`; platform dari `detectContactPlatform(url)`; label dari `resolveContactDisplayLabel`.

### `ClubEmailContactFooter` (refactor)

- Tiap nilai di kolom: `Row`/`Column` atau `Text` dengan `Img` 16×16 + `Link` / teks (react-email).
- `Img` `src={brandingIconAbsoluteUrl(...)}`, `alt=""`, inline `display: 'inline-block'`, `verticalAlign: 'middle'`.
- Jika gambar diblokir klien, teks tetap ada (degradasi graceful).

### `ClubBrandingSettingsForm` (enhance)

- Komponen client kecil `BrandingFieldIconPreview` — input URL/email → preview ikon + teks bantuan `Terdeteksi: Instagram` (muted, `text-xs`).
- Label sosial: placeholder **Opsional — kosongkan untuk nama platform otomatis**.
- Tidak mengubah nama field form / server action.

---

## Data flow

```
ClubBranding (DB)
  → loadPublicClubBranding / admin page
  → ClubContactDisplay | ClubEmailContactFooter | ClubBrandingSettingsForm
       → detectContactPlatform(url) + registry + resolveContactDisplayLabel
       → /branding-icons/*.png (web relatif, email absolut)
```

Tidak ada field baru di `saveClubBranding` / `clubBrandingTextsSchema`.

---

## Error handling

| Case | Behavior |
| ---- | -------- |
| URL sosial invalid saat submit | Zod error existing (`https://`, pasangan label/url) |
| URL valid, platform unknown | Ikon `link`, label fallback hostname |
| Semua kontak kosong | `hasAnyClubContact` false → footer disembunyikan (unchanged) |
| `BETTER_AUTH_URL` missing saat render email | Log/warn; fallback tanpa `Img` atau skip ikon — implementasi harus tidak memecah render (prefer skip ikon, keep text) |

---

## Testing

| Test | File |
| ---- | ---- |
| `detectContactPlatform` matrix | `contact-platform.test.ts` |
| `resolveContactDisplayLabel` | `resolve-contact-display-label.test.ts` |
| `brandingIconAbsoluteUrl` | `branding-icon-url.test.ts` |
| Email footer contains `Img` src | update `render-email-from-blocks.test.ts` atau dedicated footer test |
| `ClubContactDisplay` | optional RTL snapshot / render test dengan kombinasi field |

---

## Documentation & rollout

- Update `CLAUDE.md`: modul `lib/branding/contact-*`, asset `public/branding-icons/`, komponen `ContactIconRow`.
- Catatan di `2026-06-05-email-layout-branding-design.md` out-of-scope ikon **ditinggalkan** oleh spec ini (tidak edit file lama kecuali footnote opsional).

## Implementation order

1. Registry + deteksi + label resolver + tests
2. Tambah PNG assets
3. `ContactIconRow` + refactor `ClubContactDisplay`
4. Refactor `ClubEmailContactFooter` + plain-text footer parity (`club-email-plain-contact.ts` jika perlu prefix simbol teks — **v1 plain text tetap tanpa ikon unicode**; hanya HTML email dapat ikon)
5. Admin preview di `ClubBrandingSettingsForm`
6. `CLAUDE.md`

---

## Approaches considered

| Approach | Verdict |
| -------- | ------- |
| Satu paket PNG `public/` untuk web + email | **Selected** |
| Lucide web + PNG email | Rejected — inkonsisten |
| Simpan `platform` di DB on save | Rejected — YAGNI |
