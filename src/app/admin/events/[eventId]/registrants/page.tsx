import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AdminEventRegistrantsCardsView } from '@/components/admin/admin-event-registrants-cards-view'
import { AdminEventRegistrantsToolbar } from '@/components/admin/admin-event-registrants-toolbar'
import { EventRegistrantsTable } from '@/components/admin/event-registrants-table'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import {
  eventRegistrantsListPreservedQuery,
  parseEventRegistrantsSearchQuery,
  parseEventRegistrantsTab,
  parseEventRegistrantsViewParam,
  registrationListWhere,
} from '@/lib/admin/event-registrants-list-url'
import { eventRegistrantsListPath } from '@/lib/admin/event-registrants-paths'
import { canVerifyEvent } from '@/lib/permissions/guards'
import { ADMIN_TABLE_PAGE_SIZE, parseAdminTablePage, resolveClampedPage } from '@/lib/table/admin-pagination'

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const { eventId } = await params
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true },
  })
  return {
    title: event ? `Peserta Acara · ${event.title}` : 'Peserta Acara',
  }
}

function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined
  if (Array.isArray(param)) return param[0]
  return param
}

export default async function AdminEventRegistrantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { eventId } = await params

  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)

  if (!ctx) {
    return (
      <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 pb-10 pt-4'>
        <h1 className='text-2xl font-semibold tracking-tight'>Peserta Acara</h1>
        <div className='rounded-lg border border-dashed bg-card p-4 md:p-6 text-sm'>
          Profil admin belum ada. Hubungi Owner untuk aktivasi akses PIC.
        </div>
      </main>
    )
  }

  if (!canVerifyEvent(ctx, eventId)) notFound()

  const sp = (await searchParams) ?? {}
  const tab = parseEventRegistrantsTab(sp.tab)
  const q = parseEventRegistrantsSearchQuery(sp.q)
  const viewMode = parseEventRegistrantsViewParam(sp.view)

  const where = registrationListWhere(eventId, tab, q)

  const totalItems = await prisma.registration.count({
    where,
  })
  const requestedPage = parseAdminTablePage(firstString(sp.page))
  const page = resolveClampedPage(requestedPage, totalItems, ADMIN_TABLE_PAGE_SIZE)
  const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE

  const [event, registrations] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    }),
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: ADMIN_TABLE_PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        contactName: true,
        contactWhatsapp: true,
        claimedMemberNumber: true,
        computedTotalAtSubmit: true,
        status: true,
        ticketQty: true,
        ticketCategory: { select: { name: true } },
        attendanceStatus: true,
      },
    }),
  ])

  if (!event) notFound()

  const rows = registrations.map(r => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    contactName: r.contactName,
    contactWhatsapp: r.contactWhatsapp,
    claimedMemberNumber: r.claimedMemberNumber,
    computedTotalAtSubmit: r.computedTotalAtSubmit,
    status: r.status,
    ticketQty: r.ticketQty,
    ticketCategoryName: r.ticketCategory.name,
    attendanceStatus: r.attendanceStatus,
  }))

  const listPath = eventRegistrantsListPath(eventId)
  const preservedQuery = eventRegistrantsListPreservedQuery({
    tab,
    view: viewMode,
    q,
  })

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 pb-10 pt-4 lg:pt-6'>
      <header className='flex flex-col gap-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Peserta Acara</h1>
        <p className='text-sm text-muted-foreground'>Acara: {event.title}</p>
      </header>

      <AdminEventRegistrantsToolbar eventId={eventId} tab={tab} viewMode={viewMode} searchQuery={q} />

      {viewMode === 'table' ? (
        <EventRegistrantsTable
          eventId={eventId}
          listPath={listPath}
          preservedQuery={preservedQuery}
          registrations={rows}
          pagination={{
            page,
            pageSize: ADMIN_TABLE_PAGE_SIZE,
            totalItems,
          }}
        />
      ) : (
        <AdminEventRegistrantsCardsView
          eventId={eventId}
          listPath={listPath}
          preservedQuery={preservedQuery}
          registrations={rows}
          pagination={{
            page,
            pageSize: ADMIN_TABLE_PAGE_SIZE,
            totalItems,
          }}
        />
      )}
    </main>
  )
}
