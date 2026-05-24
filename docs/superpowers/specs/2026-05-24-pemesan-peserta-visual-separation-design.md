# Design: Pemisahan Visual Pemesan & Peserta di Form Registrasi

**Date:** 2026-05-24
**Status:** Approved

## Problem

Ketika `requireAllHolderData = false`, form hanya menampilkan 1 card di section "Data Peserta". User yang membeli 4 tiket merasa bingung — "kenapa data peserta cuma 1 padahal beli 4?" — karena tidak ada penanda visual yang membedakan pemesan (holder utama) dari peserta lainnya.

## Scope

Perubahan murni visual/label. Field data pemesan identik dengan field holder biasa (nama, WhatsApp, status member) — tidak ada field baru yang ditambahkan.

File yang berubah:
- `src/components/public/registration-form/holder-card.tsx`
- `src/components/public/registration-form/step-one.tsx`

## Design

### Mode primary-only (`requireAllHolderData = false`)

Card tiket 1 ditampilkan dengan elevated styling (border biru, background subtle). Di bawah card, muncul info callout **hanya jika `ticketQty > 1`**:

> "Tiket 2–N tidak memerlukan data peserta untuk acara ini."

Jika `ticketQty === 1`, callout tidak muncul (tidak ada ambiguitas).

```
[ Data Peserta ]
  ┌─────────────────────────────────┐  ← border-primary + bg-primary/5
  │ badge "Pemesan"  Tiket 1 — Anda │
  │  nama, WA, member...            │
  └─────────────────────────────────┘
  ℹ️  Tiket 2–N tidak memerlukan data peserta untuk acara ini.
```

### Mode all-holders (`requireAllHolderData = true`)

Card tiket 1 elevated (border biru + badge "Pemesan"). Card tiket 2–N tampil normal seperti sekarang. Tidak ada callout.

```
[ Data Peserta ]
  ┌─────────────────────────────────┐  ← border-primary + bg-primary/5
  │ badge "Pemesan"  Tiket 1 — Anda │
  └─────────────────────────────────┘
  ┌─────────────────────────────────┐  ← border normal
  │  Tiket 2 — Belum diisi          │
  └─────────────────────────────────┘
  ...
```

Heading section "Data Peserta" tidak diubah di kedua mode — label tetap akurat karena pemesan juga adalah peserta.

## Implementation Details

### `holder-card.tsx`

Prop `isPrimary` sudah ada. Tambahkan:
- Wrapper div card: `isPrimary` → tambah `border-primary bg-primary/5`
- Di header button (baris "Tiket 1 — Anda"): tambah badge kecil bertuliskan "Pemesan" ketika `isPrimary`

Badge: `<span>` kecil, style `bg-primary/15 text-primary text-xs rounded-full px-2 py-0.5`

### `step-one.tsx`

Setelah `</div>` penutup mapping holder cards, tambahkan conditional callout:

```tsx
{!event.requireAllHolderData && ticketQty > 1 && (
  <p className="text-sm text-muted-foreground ...">
    Tiket 2–{ticketQty} tidak memerlukan data peserta untuk acara ini.
  </p>
)}
```

Callout style: `rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground` — konsisten dengan blok estimasi total di `step-one.tsx`. Tanpa icon.

## Out of Scope

- Perubahan field atau schema form
- Perubahan step-two.tsx (ringkasan tetap seperti sekarang)
- Perubahan server action atau data model
