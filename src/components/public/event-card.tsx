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
  lowestRegularPrice: number | null
  lowestMemberPrice: number | null
  closeRegistrationAtIso: string
  badgeStatus: BadgeStatus
  memberAccessBadge?: string | null
  memberOnlyPricing?: boolean
  variant?: 'list' | 'grid'
}

const badgeConfig: Record<BadgeStatus, { label: string; className: string }> = {
  open: {
    label: 'Buka',
    className:
      'border-green-200 bg-green-50 text-green-950 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400',
  },
  closing_soon: {
    label: 'Segera Tutup',
    className:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
  },
  full: {
    label: 'Penuh',
    className: 'border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400',
  },
  closed: {
    label: 'Tutup',
    className:
      'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
  },
}

function MemberAccessBadge({ label }: { label: string }) {
  return (
    <span className='inline-flex shrink-0 items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300'>
      {label}
    </span>
  )
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
      <span className='size-1.5 rounded-full bg-current' aria-hidden='true' />
      {label}
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
  lowestRegularPrice,
  lowestMemberPrice,
  closeRegistrationAtIso,
  badgeStatus,
  memberAccessBadge = null,
  memberOnlyPricing = false,
  variant = 'list',
}: EventCardProps) {
  const when = new Date(startAtIso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const closeRegistrationDate = new Date(closeRegistrationAtIso)
  const closeDate = closeRegistrationDate.toLocaleString('id-ID', {
    dateStyle: 'medium',
  })
  const closeDateShort = closeRegistrationDate.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
  })

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
            <div className='flex shrink-0 flex-col items-end gap-1'>
              {memberAccessBadge ? <MemberAccessBadge label={memberAccessBadge} /> : null}
              <StatusBadge status={badgeStatus} />
            </div>
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
              {lowestMemberPrice != null ? (
                <div>
                  <span className='font-medium'>{formatIdr(lowestMemberPrice)}</span>{' '}
                  <span className='text-xs text-[hsl(var(--muted-foreground))]'>
                    {memberOnlyPricing ? 'harga member' : 'member'}
                  </span>
                </div>
              ) : null}
              {!memberOnlyPricing && lowestRegularPrice != null ? (
                <div>
                  <span className='font-medium'>{formatIdr(lowestRegularPrice)}</span>{' '}
                  <span className='text-xs text-[hsl(var(--muted-foreground))]'>umum</span>
                </div>
              ) : null}
              {lowestMemberPrice == null && lowestRegularPrice == null ? (
                <span className='text-[hsl(var(--muted-foreground))]'>—</span>
              ) : null}
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
            <div className='flex shrink-0 flex-col items-end gap-1'>
              {memberAccessBadge ? <MemberAccessBadge label={memberAccessBadge} /> : null}
              <StatusBadge status={badgeStatus} />
            </div>
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
              {lowestMemberPrice != null
                ? formatIdrShort(lowestMemberPrice)
                : !memberOnlyPricing && lowestRegularPrice != null
                  ? formatIdrShort(lowestRegularPrice)
                  : '—'}
            </span>
            <span>·</span>
            <span>Tutup {closeDateShort}</span>
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
