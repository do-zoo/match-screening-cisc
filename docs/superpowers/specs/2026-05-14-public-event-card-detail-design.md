# Public Event Card & Detail Page — Design Spec

**Date:** 2026-05-14
**Scope:** EventCard (grid + list variants), EventSummary (detail page), getPublicActiveEvents query

---

## Summary

Surface additional event data on the public-facing event listing and detail pages. The data is already in the DB but not yet fetched or displayed.

---

## 1. Data Layer — `getPublicActiveEvents`

### New fields added to Prisma select

```ts
openRegistrationAt: true,
closeRegistrationAt: true,
registrationManualClosed: true,
registrationCapacity: true,
ticketMemberPrice: true,
ticketNonMemberPrice: true,
_count: {
  select: {
    registrations: {
      where: { status: { notIn: ['rejected', 'cancelled', 'refunded'] } }
    }
  }
}
```

### Updated `PublicActiveEventRow` type

New fields added to the existing type:

| Field | Type | Source |
|---|---|---|
| `ticketMemberPrice` | `number` | direct |
| `ticketNonMemberPrice` | `number` | direct |
| `registrationCapacity` | `number \| null` | direct |
| `registrationsTowardQuota` | `number` | from `_count.registrations` |
| `closeRegistrationAtIso` | `string` | `closeRegistrationAt.toISOString()` |
| `badgeStatus` | `BadgeStatus` | computed in mapper |

### Badge status type

```ts
export type BadgeStatus = 'open' | 'closing_soon' | 'full' | 'closed'
```

Exported from `public-active-events.ts` so `EventCard` can import it directly.

### Badge computation (server-side in mapper, evaluated at request time)

Priority order (first match wins):

1. **`closed`** — `registrationManualClosed` is true, OR current time is outside `openRegistrationAt..closeRegistrationAt`
2. **`full`** — `registrationCapacity` is non-null AND `registrationsTowardQuota >= registrationCapacity`
3. **`closing_soon`** — `closeRegistrationAt` is within 12 hours from now
4. **`open`** — all other cases

---

## 2. EventCard — Grid Variant (`/events` listing)

Layout B (structured rows):

```
┌─────────────────────────────────────┐
│           COVER IMAGE               │
├─────────────────────────────────────┤
│ Judul Acara              [● Buka]   │
│ Ringkasan singkat dua baris...      │
│ Venue · 10 Jun 2026, 03.00          │
│ Tutup pendaftaran: 5 Jun 2026       │
│─────────────────────────────────────│
│ Rp 150.000 member        12 / 50    │
│ Rp 200.000 umum          sisa       │
└─────────────────────────────────────┘
```

- Badge at top-right of title row (`shrink-0`)
- Registration close date shown above the divider
- Divider (`<hr>`) separates meta from price/quota
- Price: full IDR format (`Rp 150.000`, `Rp 200.000`), labeled "member" and "umum"
- Quota: `X / Y sisa` when capacity set; `∞ Tak terbatas` when `registrationCapacity` is null

### Badge colors

| Status | Color |
|---|---|
| `open` | Green (`badge-open`) |
| `closing_soon` | Amber/orange (`badge-soon`) |
| `full` | Red (`badge-full`) |
| `closed` | Gray (`badge-closed`) |

---

## 3. EventCard — List Variant (homepage preview)

Layout A (same data, condensed):

```
┌─────┬─────────────────────────────────────┐
│     │ Judul Acara              [● Buka]   │
│ IMG │ Ringkasan singkat...                │
│     │ Venue · 10 Jun, 03.00               │
│     │─────────────────────────────────────│
│     │ Rp 150K/200K · Tutup 5 Jun · 12 sisa│
└─────┴─────────────────────────────────────┘
```

- Same badge as grid, placed at top-right of title
- Divider separates meta from condensed info row
- Condensed info row: short price + deadline + quota in one line

### `formatIdrShort` helper (new)

New utility function for condensed display only (Indonesian locale — comma as decimal separator):

- `150_000` → `"Rp 150K"`
- `1_500_000` → `"Rp 1,5jt"`
- `10_000_000` → `"Rp 10jt"`

Location: `src/lib/utils/format-idr-short.ts`

Grid card continues to use existing full IDR format from `format-idr.ts`.

---

## 4. New Props on `EventCard`

```ts
type EventCardProps = {
  // existing
  slug: string
  title: string
  summary: string
  coverBlobUrl: string
  venueName: string
  startAtIso: string
  variant?: 'list' | 'grid'

  // new
  ticketMemberPrice: number
  ticketNonMemberPrice: number
  registrationCapacity: number | null
  registrationsTowardQuota: number
  closeRegistrationAtIso: string
  badgeStatus: BadgeStatus
}
```

All call sites (`/events` page and homepage) pass the new props from `PublicActiveEventRow`.

---

## 5. EventSummary — Detail Page (`/events/[slug]`)

### New fields in `SerializedEventForRegistration`

```ts
venueAddress: string
venueMapUrl: string | null
```

Source: already included via `venue: true` in `getActiveEventRegistrationPageData` — just needs to be exposed in the serializer.

### Updated info display

Replace the current dense single-line meta with a structured `<dl>` grid:

| Label | Value |
|---|---|
| Venue | La Liga Venue |
| Alamat | Jl. Sudirman No. 1, Jakarta &nbsp; `[MapPin icon →]` |
| Registrasi | 1 Jun 2026 — 5 Jun 2026 |
| Gate dibuka | 10 Jun 2026, 02.30 |
| Mulai | 10 Jun 2026, 03.00 |
| Harga tiket | Rp 150.000 (member) / Rp 200.000 (umum) |

### Map icon link

- Icon-only `<a>` (`MapPin` or `ExternalLink` from Lucide) placed inline at end of Alamat row
- `href`: `venueMapUrl` if non-null, otherwise `https://maps.google.com/?q=<encodeURIComponent(venueAddress)>` (address alone is sufficient for search)
- `target="_blank" rel="noopener noreferrer"`
- No iframe embed (`MapEmbedPreview` not used on this page)

### Pricing

`ticketMemberPrice` and `ticketNonMemberPrice` are already in `SerializedEventForRegistration` — just add a Harga tiket row to the `<dl>`.

---

## 6. Files Changed

| File | Change |
|---|---|
| `src/lib/events/public-active-events.ts` | Extend select + mapper, add badge computation |
| `src/lib/utils/format-idr-short.ts` | New helper |
| `src/components/public/event-card.tsx` | New props, updated grid + list layout |
| `src/components/public/event-serialization.ts` | Add `venueAddress`, `venueMapUrl` |
| `src/lib/events/event-registration-page.ts` | Expose venue address + mapUrl in serializer |
| `src/components/public/event-summary.tsx` | Replace meta line with `<dl>`, add map icon, add pricing row |
| `src/app/(public)/events/page.tsx` | Pass new props to `EventCard` |
| `src/components/public/home-landing.tsx` | Pass new props to `EventCard` |

---

## 7. Out of Scope

- No changes to admin pages
- No changes to registration form or `SerializedEventForRegistration` pricing logic
- No iframe map embed on public pages
- `EventSummary` badge not added (existing closed-registration `Alert` is sufficient)
