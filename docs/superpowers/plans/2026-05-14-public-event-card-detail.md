# Public Event Card & Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface ticket prices, registration deadline, status badge, and quota on the public EventCard (both grid and list variants) and add structured venue details + pricing to the EventSummary detail page.

**Architecture:** Extend `getPublicActiveEvents` with a single Prisma query that uses `_count` to count active registrations alongside the new fields; compute `BadgeStatus` server-side in the mapper. Update `EventCard` props and layout for both variants. Update `EventSummary` to replace the dense single-line meta with a `<dl>` grid that includes venue address (with a map icon link) and pricing.

**Tech Stack:** Next.js App Router, Prisma (Neon adapter), TypeScript, Tailwind CSS, Lucide React icons, Vitest

---

## Before You Start

Ensure Node 24 is active:

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
```

Run all tests before starting to confirm a clean baseline:

```bash
pnpm test
```

Expected: all tests pass.

---

## Task 1: `formatIdrShort` utility

**Files:**

- Create: `src/lib/utils/format-idr-short.ts`
- Create: `src/lib/utils/format-idr-short.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/utils/format-idr-short.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatIdrShort } from './format-idr-short'

describe('formatIdrShort', () => {
  it('formats thousands as K', () => {
    expect(formatIdrShort(150_000)).toBe('Rp 150K')
    expect(formatIdrShort(75_000)).toBe('Rp 75K')
    expect(formatIdrShort(1_000)).toBe('Rp 1K')
  })

  it('formats millions as jt with Indonesian decimal comma', () => {
    expect(formatIdrShort(1_000_000)).toBe('Rp 1jt')
    expect(formatIdrShort(1_500_000)).toBe('Rp 1,5jt')
    expect(formatIdrShort(10_000_000)).toBe('Rp 10jt')
    expect(formatIdrShort(2_750_000)).toBe('Rp 2,8jt')
  })

  it('formats sub-thousand amounts as plain Rp', () => {
    expect(formatIdrShort(500)).toBe('Rp 500')
    expect(formatIdrShort(0)).toBe('Rp 0')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm vitest run src/lib/utils/format-idr-short.test.ts
```

Expected: fails with "Cannot find module './format-idr-short'"

- [ ] **Step 3: Implement the utility**

Create `src/lib/utils/format-idr-short.ts`:

```ts
export function formatIdrShort(amount: number): string {
  if (amount >= 1_000_000) {
    const juta = amount / 1_000_000
    const formatted = new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }).format(juta)
    return `Rp ${formatted}jt`
  }
  if (amount >= 1_000) {
    const ribu = Math.round(amount / 1_000)
    return `Rp ${ribu}K`
  }
  return `Rp ${amount}`
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run src/lib/utils/format-idr-short.test.ts
```

Expected: all 3 test cases pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/format-idr-short.ts src/lib/utils/format-idr-short.test.ts
git commit -m "feat(utils): add formatIdrShort for condensed IDR display"
```

---

## Task 2: `BadgeStatus` type + `computeBadgeStatus` + extend `getPublicActiveEvents`

**Files:**

- Modify: `src/lib/events/public-active-events.ts`
- Create: `src/lib/events/public-active-events.test.ts`

- [ ] **Step 1: Write failing tests for `computeBadgeStatus`**

Create `src/lib/events/public-active-events.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeBadgeStatus } from './public-active-events'

const base = {
  registrationManualClosed: false,
  openRegistrationAt: new Date('2026-06-01T00:00:00Z'),
  closeRegistrationAt: new Date('2026-06-05T00:00:00Z'),
  registrationCapacity: 50,
  registrationsTowardQuota: 10,
}

describe('computeBadgeStatus', () => {
  it("returns 'closed' when registrationManualClosed is true", () => {
    expect(
      computeBadgeStatus({
        ...base,
        registrationManualClosed: true,
        now: new Date('2026-06-03T00:00:00Z'),
      }),
    ).toBe('closed')
  })

  it("returns 'closed' when now is before openRegistrationAt", () => {
    expect(computeBadgeStatus({ ...base, now: new Date('2026-05-31T23:59:59Z') })).toBe('closed')
  })

  it("returns 'closed' when now is at or after closeRegistrationAt", () => {
    expect(computeBadgeStatus({ ...base, now: new Date('2026-06-05T00:00:00Z') })).toBe('closed')
    expect(computeBadgeStatus({ ...base, now: new Date('2026-06-06T00:00:00Z') })).toBe('closed')
  })

  it("returns 'full' when registrationsTowardQuota >= registrationCapacity", () => {
    expect(
      computeBadgeStatus({
        ...base,
        registrationsTowardQuota: 50,
        now: new Date('2026-06-03T00:00:00Z'),
      }),
    ).toBe('full')
  })

  it("returns 'full' takes priority over 'closing_soon'", () => {
    expect(
      computeBadgeStatus({
        ...base,
        registrationsTowardQuota: 50,
        // Within 12 hours of close
        now: new Date('2026-06-04T20:00:00Z'),
      }),
    ).toBe('full')
  })

  it("does NOT return 'full' when registrationCapacity is null", () => {
    expect(
      computeBadgeStatus({
        ...base,
        registrationCapacity: null,
        registrationsTowardQuota: 999,
        now: new Date('2026-06-03T00:00:00Z'),
      }),
    ).toBe('open')
  })

  it("does NOT return 'full' when registrationCapacity is 0 or negative", () => {
    expect(
      computeBadgeStatus({
        ...base,
        registrationCapacity: 0,
        registrationsTowardQuota: 999,
        now: new Date('2026-06-03T00:00:00Z'),
      }),
    ).toBe('open')
  })

  it("returns 'closing_soon' when within 12 hours of closeRegistrationAt", () => {
    // Exactly 12 hours before close
    expect(computeBadgeStatus({ ...base, now: new Date('2026-06-04T12:00:00Z') })).toBe('closing_soon')
    // 1 second before close
    expect(computeBadgeStatus({ ...base, now: new Date('2026-06-04T23:59:59Z') })).toBe('closing_soon')
  })

  it("returns 'open' outside the closing_soon window", () => {
    // 12 hours + 1 second before close
    expect(computeBadgeStatus({ ...base, now: new Date('2026-06-04T11:59:59Z') })).toBe('open')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm vitest run src/lib/events/public-active-events.test.ts
```

Expected: fails with "computeBadgeStatus is not exported"

- [ ] **Step 3: Replace `src/lib/events/public-active-events.ts` with extended version**

```ts
import { prisma } from '@/lib/db/prisma'

export type BadgeStatus = 'open' | 'closing_soon' | 'full' | 'closed'

const CLOSING_SOON_WINDOW_MS = 12 * 60 * 60 * 1000 // 12 hours

export function computeBadgeStatus(args: {
  registrationManualClosed: boolean
  openRegistrationAt: Date
  closeRegistrationAt: Date
  registrationCapacity: number | null
  registrationsTowardQuota: number
  now?: Date
}): BadgeStatus {
  const now = args.now ?? new Date()

  // 1. closed — manual override or outside time window
  if (args.registrationManualClosed || now < args.openRegistrationAt || now >= args.closeRegistrationAt) {
    return 'closed'
  }

  // 2. full — capacity reached (0 or negative treated as unlimited, per registration-window.ts convention)
  if (
    args.registrationCapacity != null &&
    args.registrationCapacity > 0 &&
    args.registrationsTowardQuota >= args.registrationCapacity
  ) {
    return 'full'
  }

  // 3. closing_soon — within 12 hours of close
  if (args.closeRegistrationAt.getTime() - now.getTime() <= CLOSING_SOON_WINDOW_MS) {
    return 'closing_soon'
  }

  // 4. open
  return 'open'
}

const publicActiveEventSelect = {
  slug: true,
  title: true,
  summary: true,
  coverBlobUrl: true,
  kickOffAt: true,
  openRegistrationAt: true,
  closeRegistrationAt: true,
  registrationManualClosed: true,
  registrationCapacity: true,
  ticketMemberPrice: true,
  ticketNonMemberPrice: true,
  venue: { select: { name: true } },
  _count: {
    select: {
      registrations: {
        where: {
          // matches REGISTRATION_STATUS_EXCLUDED_FROM_QUOTA in registration-window.ts
          status: { notIn: ['rejected', 'cancelled', 'refunded'] },
        },
      },
    },
  },
}

export type PublicActiveEventRow = {
  slug: string
  title: string
  summary: string
  coverBlobUrl: string
  /** Waktu mulai acara (kick-off), untuk tampilan publik. */
  startAtIso: string
  venueName: string
  ticketMemberPrice: number
  ticketNonMemberPrice: number
  registrationCapacity: number | null
  registrationsTowardQuota: number
  closeRegistrationAtIso: string
  badgeStatus: BadgeStatus
}

export async function getPublicActiveEvents(): Promise<PublicActiveEventRow[]> {
  const now = new Date()
  const rows = await prisma.event.findMany({
    where: { status: 'active' },
    orderBy: { kickOffAt: 'asc' },
    select: publicActiveEventSelect,
  })

  return rows.map(e => ({
    slug: e.slug,
    title: e.title,
    summary: e.summary,
    coverBlobUrl: e.coverBlobUrl,
    venueName: e.venue.name,
    startAtIso: e.kickOffAt.toISOString(),
    ticketMemberPrice: e.ticketMemberPrice,
    ticketNonMemberPrice: e.ticketNonMemberPrice,
    registrationCapacity: e.registrationCapacity,
    registrationsTowardQuota: e._count.registrations,
    closeRegistrationAtIso: e.closeRegistrationAt.toISOString(),
    badgeStatus: computeBadgeStatus({
      registrationManualClosed: e.registrationManualClosed,
      openRegistrationAt: e.openRegistrationAt,
      closeRegistrationAt: e.closeRegistrationAt,
      registrationCapacity: e.registrationCapacity,
      registrationsTowardQuota: e._count.registrations,
      now,
    }),
  }))
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run src/lib/events/public-active-events.test.ts
```

Expected: all 9 test cases pass.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/events/public-active-events.ts src/lib/events/public-active-events.test.ts
git commit -m "feat(events): extend getPublicActiveEvents with pricing, quota, and badge status"
```

---

## Task 3: Update `EventCard` — new props + grid + list layouts

**Files:**

- Modify: `src/components/public/event-card.tsx`

- [ ] **Step 1: Replace `src/components/public/event-card.tsx`**

```tsx
'use client'

import GlareHover from '@/components/GlareHover'
import type { BadgeStatus } from '@/lib/events/public-active-events'
import { formatIdrShort } from '@/lib/utils/format-idr-short'
import { formatIdr } from '@/lib/utils/format-idr'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'

type EventCardProps = {
  slug: string
  title: string
  summary: string
  coverBlobUrl: string
  venueName: string
  startAtIso: string
  ticketMemberPrice: number
  ticketNonMemberPrice: number
  registrationCapacity: number | null
  registrationsTowardQuota: number
  closeRegistrationAtIso: string
  badgeStatus: BadgeStatus
  variant?: 'list' | 'grid'
}

const badgeConfig: Record<BadgeStatus, { label: string; className: string }> = {
  open: {
    label: 'Buka',
    className: 'bg-green-950 text-green-400 border border-green-800',
  },
  closing_soon: {
    label: 'Segera Tutup',
    className: 'bg-amber-950 text-amber-400 border border-amber-800',
  },
  full: {
    label: 'Penuh',
    className: 'bg-red-950 text-red-400 border border-red-800',
  },
  closed: {
    label: 'Tutup',
    className: 'bg-neutral-800 text-neutral-400 border border-neutral-700',
  },
}

function StatusBadge({ status }: { status: BadgeStatus }) {
  const { label, className } = badgeConfig[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        className,
      )}
    >
      <span className='size-1.5 rounded-full bg-current' />
      {label}
    </span>
  )
}

function QuotaDisplay({
  registrationCapacity,
  registrationsTowardQuota,
}: {
  registrationCapacity: number | null
  registrationsTowardQuota: number
}) {
  if (registrationCapacity == null || registrationCapacity <= 0) {
    return <span>∞ Tak terbatas</span>
  }
  const remaining = Math.max(0, registrationCapacity - registrationsTowardQuota)
  return (
    <span>
      {remaining} / {registrationCapacity} sisa
    </span>
  )
}

export function EventCard({
  slug,
  title,
  summary,
  coverBlobUrl,
  venueName,
  startAtIso,
  ticketMemberPrice,
  ticketNonMemberPrice,
  registrationCapacity,
  registrationsTowardQuota,
  closeRegistrationAtIso,
  badgeStatus,
  variant = 'list',
}: EventCardProps) {
  const when = new Date(startAtIso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const closeDate = new Date(closeRegistrationAtIso).toLocaleString('id-ID', {
    dateStyle: 'medium',
  })

  const closeDateShort = new Date(closeRegistrationAtIso).toLocaleString('id-ID', { day: 'numeric', month: 'short' })

  const radius = variant === 'grid' ? 'var(--radius-lg)' : 'calc(var(--radius-lg) - 2px)'

  const inner =
    variant === 'grid' ? (
      <>
        <div className='relative aspect-1200/630 w-full shrink-0 overflow-hidden rounded-t-lg'>
          <Image src={coverBlobUrl} alt='' fill className='object-cover' sizes='(max-width: 640px) 100vw, 50vw' />
        </div>
        <div className='flex min-w-0 flex-1 flex-col p-4'>
          {/* Title row + badge */}
          <div className='flex items-start justify-between gap-2'>
            <div className='font-medium leading-snug'>{title}</div>
            <StatusBadge status={badgeStatus} />
          </div>
          {/* Summary */}
          <p className='mt-2 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]'>{summary}</p>
          {/* Venue + kickoff */}
          <div className='mt-1 text-sm text-[hsl(var(--muted-foreground))]'>
            {venueName} · {when}
          </div>
          {/* Deadline */}
          <div className='mt-1 text-xs text-[hsl(var(--muted-foreground))]'>Tutup pendaftaran: {closeDate}</div>
          {/* Divider */}
          <div className='my-3 h-px bg-[hsl(var(--border))]' />
          {/* Price + quota row */}
          <div className='flex items-end justify-between gap-2'>
            <div className='text-sm'>
              <div>
                <span className='font-medium'>{formatIdr(ticketMemberPrice)}</span>{' '}
                <span className='text-xs text-[hsl(var(--muted-foreground))]'>member</span>
              </div>
              <div>
                <span className='font-medium'>{formatIdr(ticketNonMemberPrice)}</span>{' '}
                <span className='text-xs text-[hsl(var(--muted-foreground))]'>umum</span>
              </div>
            </div>
            <div className='text-right text-xs text-[hsl(var(--muted-foreground))]'>
              <QuotaDisplay
                registrationCapacity={registrationCapacity}
                registrationsTowardQuota={registrationsTowardQuota}
              />
            </div>
          </div>
        </div>
      </>
    ) : (
      <>
        <Image
          src={coverBlobUrl}
          alt=''
          width={96}
          height={96}
          className='size-24 shrink-0 rounded-md object-cover'
          sizes='96px'
        />
        <div className='flex min-w-0 flex-1 flex-col text-left'>
          {/* Title row + badge */}
          <div className='flex items-start justify-between gap-2'>
            <div className='font-medium leading-snug'>{title}</div>
            <StatusBadge status={badgeStatus} />
          </div>
          <p className='mt-1 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]'>{summary}</p>
          <div className='mt-1 text-sm text-[hsl(var(--muted-foreground))]'>
            {venueName} · {when}
          </div>
          {/* Divider */}
          <div className='my-2 h-px bg-[hsl(var(--border))]' />
          {/* Condensed info row */}
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]'>
            <span className='font-medium text-[hsl(var(--foreground))]'>
              {formatIdrShort(ticketMemberPrice)}/{formatIdrShort(ticketNonMemberPrice)}
            </span>
            <span>·</span>
            <span>Tutup {closeDateShort}</span>
            <span>·</span>
            <QuotaDisplay
              registrationCapacity={registrationCapacity}
              registrationsTowardQuota={registrationsTowardQuota}
            />
          </div>
        </div>
      </>
    )

  return (
    <GlareHover
      width='100%'
      height='100%'
      background='hsl(var(--card))'
      borderColor='hsl(var(--border))'
      borderRadius={radius}
      glareOpacity={0.22}
      className={cn(
        'flex overflow-hidden shadow-sm transition-shadow hover:shadow-md',
        variant === 'grid' ? 'flex-col items-stretch' : 'min-h-0 flex-row items-stretch',
      )}
      style={{
        width: '100%',
        minHeight: variant === 'list' ? undefined : '100%',
      }}
    >
      <Link
        href={`/events/${slug}`}
        className={cn(
          'relative z-1 flex text-[hsl(var(--foreground))] no-underline outline-none ring-offset-[hsl(var(--background))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
          variant === 'grid' ? 'min-h-0 w-full flex-1 flex-col' : 'w-full gap-4 p-3',
        )}
      >
        {inner}
      </Link>
    </GlareHover>
  )
}
```

- [ ] **Step 2: Type-check to catch any errors**

```bash
pnpm check-types
```

Expected: no TypeScript errors. Fix any that appear before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/components/public/event-card.tsx
git commit -m "feat(event-card): add badge, pricing, quota, and deadline to both variants"
```

---

## Task 4: Update call sites — pass new props

**Files:**

- Modify: `src/app/(public)/events/page.tsx`
- Modify: `src/components/public/home-landing.tsx`

- [ ] **Step 1: Update `src/app/(public)/events/page.tsx`**

Replace the `<EventCard ... />` call (the `events.map` block) to pass new props:

```tsx
{
  events.map(e => (
    <li key={e.slug}>
      <EventCard
        slug={e.slug}
        title={e.title}
        summary={e.summary}
        coverBlobUrl={e.coverBlobUrl}
        venueName={e.venueName}
        startAtIso={e.startAtIso}
        ticketMemberPrice={e.ticketMemberPrice}
        ticketNonMemberPrice={e.ticketNonMemberPrice}
        registrationCapacity={e.registrationCapacity}
        registrationsTowardQuota={e.registrationsTowardQuota}
        closeRegistrationAtIso={e.closeRegistrationAtIso}
        badgeStatus={e.badgeStatus}
        variant='grid'
      />
    </li>
  ))
}
```

- [ ] **Step 2: Update `src/components/public/home-landing.tsx`**

Replace the `<EventCard ... />` call (the `previewEvents.map` block) to pass new props:

```tsx
{
  previewEvents.map(e => (
    <li key={e.slug}>
      <EventCard
        slug={e.slug}
        title={e.title}
        summary={e.summary}
        coverBlobUrl={e.coverBlobUrl}
        venueName={e.venueName}
        startAtIso={e.startAtIso}
        ticketMemberPrice={e.ticketMemberPrice}
        ticketNonMemberPrice={e.ticketNonMemberPrice}
        registrationCapacity={e.registrationCapacity}
        registrationsTowardQuota={e.registrationsTowardQuota}
        closeRegistrationAtIso={e.closeRegistrationAtIso}
        badgeStatus={e.badgeStatus}
        variant='list'
      />
    </li>
  ))
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm check-types
```

Expected: no TypeScript errors.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(public\)/events/page.tsx src/components/public/home-landing.tsx
git commit -m "feat(public-pages): pass new EventCard props from PublicActiveEventRow"
```

---

## Task 5: Extend `SerializedEventForRegistration` + serializer

**Files:**

- Modify: `src/components/public/event-serialization.ts`
- Modify: `src/lib/events/event-registration-page.ts`

- [ ] **Step 1: Add `venueAddress` and `venueMapUrl` to `SerializedEventForRegistration`**

In `src/components/public/event-serialization.ts`, add two fields to the `SerializedEventForRegistration` type (after `venueName`):

```ts
venueName: string
venueAddress: string
venueMapUrl: string | null
```

- [ ] **Step 2: Expose the new fields in the serializer**

In `src/lib/events/event-registration-page.ts`, inside the `return { ... }` block of `getSerializedEventForPublicRegistration`, add after `venueName`:

```ts
venueAddress: event.venue.address,
venueMapUrl: event.venue.mapUrl ?? null,
```

- [ ] **Step 3: Type-check**

```bash
pnpm check-types
```

Expected: no TypeScript errors. (If TypeScript complains about missing fields in consumers of `SerializedEventForRegistration`, add them there too.)

- [ ] **Step 4: Commit**

```bash
git add src/components/public/event-serialization.ts src/lib/events/event-registration-page.ts
git commit -m "feat(event-serialization): expose venueAddress and venueMapUrl for public detail page"
```

---

## Task 6: Update `EventSummary` — structured `<dl>`, map icon, pricing

**Files:**

- Modify: `src/components/public/event-summary.tsx`

- [ ] **Step 1: Replace `src/components/public/event-summary.tsx`**

```tsx
import Image from 'next/image'
import parse from 'html-react-parser'
import { MapPin } from 'lucide-react'

import type { SerializedEventForRegistration } from '@/components/public/event-serialization'
import { formatIdr } from '@/lib/utils/format-idr'
import { cn } from '@/lib/utils'

type Props = {
  event: SerializedEventForRegistration
}

export function EventSummary({ event }: Props) {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('id-ID', opts)

  const dateTimeLong: Intl.DateTimeFormatOptions = {
    dateStyle: 'long',
    timeStyle: 'short',
  }

  const mapHref = event.venueMapUrl
    ? event.venueMapUrl
    : `https://maps.google.com/?q=${encodeURIComponent(event.venueAddress)}`

  return (
    <div className='flex flex-col gap-4'>
      <Image
        src={event.coverBlobUrl}
        alt=''
        width={1200}
        height={630}
        className='aspect-1200/630 w-full rounded-lg border border-border object-cover'
        sizes='(max-width: 768px) 100vw, 672px'
        priority
      />

      <div className='flex flex-col gap-3'>
        <div>
          <h1 className='font-semibold text-lg tracking-tight'>{event.title}</h1>
          <p className='mt-1 text-sm text-[hsl(var(--muted-foreground))]'>{event.summary}</p>
        </div>

        {/* Structured info table */}
        <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm'>
          <dt className='text-[hsl(var(--muted-foreground))]'>Venue</dt>
          <dd>{event.venueName}</dd>

          <dt className='text-[hsl(var(--muted-foreground))]'>Alamat</dt>
          <dd className='flex items-center gap-1.5'>
            <span>{event.venueAddress}</span>
            <a
              href={mapHref}
              target='_blank'
              rel='noopener noreferrer'
              className='shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              aria-label='Buka lokasi di peta'
            >
              <MapPin className='size-3.5' />
            </a>
          </dd>

          <dt className='text-[hsl(var(--muted-foreground))]'>Registrasi</dt>
          <dd>
            {fmt(event.openRegistrationAtIso, dateTimeLong)} — {fmt(event.closeRegistrationAtIso, dateTimeLong)}
          </dd>

          <dt className='text-[hsl(var(--muted-foreground))]'>Gate dibuka</dt>
          <dd>{fmt(event.openGateAtIso, dateTimeLong)}</dd>

          <dt className='text-[hsl(var(--muted-foreground))]'>Mulai</dt>
          <dd>{fmt(event.kickOffAtIso, dateTimeLong)}</dd>

          <dt className='text-[hsl(var(--muted-foreground))]'>Harga tiket</dt>
          <dd>
            {formatIdr(event.ticketMemberPrice)} <span className='text-[hsl(var(--muted-foreground))]'>(member)</span>
            {' / '}
            {formatIdr(event.ticketNonMemberPrice)} <span className='text-[hsl(var(--muted-foreground))]'>(umum)</span>
          </dd>
        </dl>
      </div>

      <div
        className={cn(
          'event-description max-w-none space-y-3 text-sm leading-relaxed text-[hsl(var(--foreground))]',
          '[&_p]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic',
          '[&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold',
        )}
      >
        {parse(event.descriptionHtml)}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/public/event-summary.tsx
git commit -m "feat(event-summary): structured info table with venue address, map icon, and pricing"
```

---

## Final Verification

- [ ] **Start dev server and smoke-test**

```bash
pnpm dev
```

Visit:

1. `http://localhost:3000` — homepage should show list cards with badge, condensed price, deadline, quota
2. `http://localhost:3000/events` — grid cards with badge, full price, deadline, quota
3. `http://localhost:3000/events/<slug>` — detail page with `<dl>` info table, map icon link, pricing row

- [ ] **Run full test suite one final time**

```bash
pnpm test
```

Expected: all tests pass with no regressions.
