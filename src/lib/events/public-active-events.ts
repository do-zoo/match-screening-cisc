import { prisma } from '@/lib/db/prisma'

export type BadgeStatus = 'open' | 'closing_soon' | 'full' | 'closed'

const CLOSING_SOON_WINDOW_MS = 12 * 60 * 60 * 1000 // 12 hours

export function computeBadgeStatus(args: {
  registrationManualClosed: boolean
  openRegistrationAt: Date
  closeRegistrationAt: Date
  /** True when all active categories with a capacity limit are at or above that limit. */
  allCategoriesFull: boolean
  now?: Date
}): BadgeStatus {
  const now = args.now ?? new Date()

  // 1. closed — manual override or outside time window
  if (args.registrationManualClosed || now < args.openRegistrationAt || now >= args.closeRegistrationAt) {
    return 'closed'
  }

  // 2. full — all capped categories have reached their limit
  if (args.allCategoriesFull) {
    return 'full'
  }

  // 3. closing_soon — within 12 hours of close
  if (args.closeRegistrationAt.getTime() - now.getTime() <= CLOSING_SOON_WINDOW_MS) {
    return 'closing_soon'
  }

  // 4. open
  return 'open'
}

export type PublicActiveEventRow = {
  slug: string
  title: string
  summary: string
  coverBlobUrl: string
  /** Waktu mulai acara (kick-off), untuk tampilan publik. */
  startAtIso: string
  venueName: string
  /** Harga tiket reguler terendah di semua kategori aktif, atau null jika belum ada kategori. */
  lowestRegularPrice: number | null
  /** Harga tiket member terendah di semua kategori aktif, atau null jika belum ada kategori. */
  lowestMemberPrice: number | null
  closeRegistrationAtIso: string
  badgeStatus: BadgeStatus
}

export async function getPublicActiveEvents(): Promise<PublicActiveEventRow[]> {
  const now = new Date()
  // Select inlined so Prisma can infer generic types for _count filtered relation
  const rows = await prisma.event.findMany({
    where: { status: 'active' },
    orderBy: { kickOffAt: 'asc' },
    select: {
      slug: true,
      title: true,
      summary: true,
      coverBlobUrl: true,
      kickOffAt: true,
      openRegistrationAt: true,
      closeRegistrationAt: true,
      registrationManualClosed: true,
      ticketCategories: {
        where: { isActive: true },
        select: {
          regularPrice: true,
          memberPrice: true,
          capacity: true,
          _count: {
            select: {
              registrations: {
                where: { status: { notIn: ['rejected', 'cancelled', 'refunded'] } },
              },
            },
          },
        },
      },
      venue: { select: { name: true } },
    },
  })

  return rows.map(e => {
    const categoriesWithCapacity = e.ticketCategories.filter(c => c.capacity != null && c.capacity > 0)
    const allCategoriesFull =
      categoriesWithCapacity.length > 0 && categoriesWithCapacity.every(c => c._count.registrations >= c.capacity!)
    return {
      slug: e.slug,
      title: e.title,
      summary: e.summary,
      coverBlobUrl: e.coverBlobUrl,
      venueName: e.venue.name,
      startAtIso: e.kickOffAt.toISOString(),
      lowestRegularPrice:
        e.ticketCategories.length > 0 ? Math.min(...e.ticketCategories.map(c => c.regularPrice)) : null,
      lowestMemberPrice:
        e.ticketCategories.length > 0 ? Math.min(...e.ticketCategories.map(c => c.memberPrice)) : null,
      closeRegistrationAtIso: e.closeRegistrationAt.toISOString(),
      badgeStatus: computeBadgeStatus({
        registrationManualClosed: e.registrationManualClosed,
        openRegistrationAt: e.openRegistrationAt,
        closeRegistrationAt: e.closeRegistrationAt,
        allCategoriesFull,
        now,
      }),
    }
  })
}
