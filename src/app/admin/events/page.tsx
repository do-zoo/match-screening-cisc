import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import type { EventStatus, Prisma } from '@prisma/client'

export const metadata: Metadata = { title: 'Acara' }

import { AdminEventsCardsView } from '@/components/admin/admin-events-cards-view'
import { AdminEventsIndexHeader } from '@/components/admin/admin-events-index-header'
import { AdminEventsIndexToolbar } from '@/components/admin/admin-events-index-toolbar'
import { AdminEventsPendingReviewAlert } from '@/components/admin/admin-events-pending-review-alert'
import { AdminEventsTable } from '@/components/admin/admin-events-table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { parseEventsIndexSearchQuery, parseEventsIndexViewParam } from '@/lib/admin/events-index-view'
import { parseEventsIndexStatusTab } from '@/lib/admin/events-index-view-model'
import { loadAdminEventsIndex } from '@/lib/admin/load-admin-events-index'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { hasOperationalOwnerParity } from '@/lib/permissions/roles'
import { ADMIN_TABLE_PAGE_SIZE, parseAdminTablePage, resolveClampedPage } from '@/lib/table/admin-pagination'

function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined
  if (Array.isArray(param)) return param[0]
  return param
}

function tabParamMissing(tabParam: string | string[] | undefined): boolean {
  return (
    tabParam === undefined ||
    tabParam === '' ||
    (Array.isArray(tabParam) && (tabParam.length === 0 || tabParam[0] === ''))
  )
}

export default async function AdminEventsIndexPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)

  if (!ctx) {
    return (
      <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-10'>
        <h1 className='text-2xl font-semibold tracking-tight'>Acara</h1>
        <Alert variant='destructive'>
          <AlertTitle>Profil admin belum ada</AlertTitle>
          <AlertDescription>
            Akun Anda belum dikaitkan ke AdminProfile. Hubungi Owner untuk aktivasi akses PIC.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const sp = (await searchParams) ?? {}
  const isOps = hasOperationalOwnerParity(ctx.role)
  const viewMode = isOps ? parseEventsIndexViewParam(sp.view) : 'cards'

  if (tabParamMissing(sp.tab)) {
    const p = new URLSearchParams()
    p.set('tab', 'active')
    if (isOps && viewMode === 'table') p.set('view', 'tabel')
    const qEarly = parseEventsIndexSearchQuery(sp.q)
    if (qEarly) p.set('q', qEarly)
    redirect(`/admin/events?${p.toString()}`)
  }

  const tab = parseEventsIndexStatusTab(sp.tab)
  const q = parseEventsIndexSearchQuery(sp.q)

  if (viewMode === 'table' && isOps) {
    const requestedPage = parseAdminTablePage(firstString(sp.page))
    const andParts: Prisma.EventWhereInput[] = []
    if (tab !== 'all') andParts.push({ status: tab as EventStatus })
    if (q) {
      andParts.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { venue: { name: { contains: q, mode: 'insensitive' } } },
        ],
      })
    }
    const eventWhere = andParts.length > 0 ? { AND: andParts } : {}

    const totalItems = await prisma.event.count({ where: eventWhere })
    const page = resolveClampedPage(requestedPage, totalItems, ADMIN_TABLE_PAGE_SIZE)
    const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE

    const events = await prisma.event.findMany({
      where: eventWhere,
      orderBy: [{ kickOffAt: 'desc' }],
      skip,
      take: ADMIN_TABLE_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        kickOffAt: true,
        picAdminProfile: {
          select: {
            authUserId: true,
            managementMember: { select: { fullName: true } },
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    })

    const picAuthIds = [...new Set(events.map(e => e.picAdminProfile.authUserId))]
    const picUsers =
      picAuthIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: picAuthIds } },
            select: { id: true, name: true, email: true },
          })
        : []
    const userById = new Map(picUsers.map(u => [u.id, u]))

    const eventRows = events.map(event => {
      const u = userById.get(event.picAdminProfile.authUserId)
      const picFullName =
        event.picAdminProfile.managementMember?.fullName?.trim() || u?.name?.trim() || u?.email || null
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        status: event.status,
        startAtIso: event.kickOffAt.toISOString(),
        picFullName,
        registrationCount: event._count.registrations,
      }
    })

    const pendingReviewRecapTotal = await prisma.registration.count({
      where: {
        status: 'pending_review',
        event: eventWhere,
      },
    })

    return (
      <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-8 lg:py-10'>
        <AdminEventsIndexHeader isOps />

        <AdminEventsIndexToolbar
          key={`events-idx-toolbar-${tab}-table`}
          tab={tab}
          viewMode='table'
          isOps
          searchQuery={q}
        />

        <AdminEventsPendingReviewAlert pendingReviewRecapTotal={pendingReviewRecapTotal} />

        {totalItems === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Belum ada acara untuk filter ini. Mulai dengan membuat acara baru untuk membuka pendaftaran dan daftar
            peserta untuk verifikasi.
          </p>
        ) : (
          <AdminEventsTable
            pathname='/admin/events'
            preservedQuery={{
              view: 'tabel',
              tab,
              ...(q ? { q } : {}),
            }}
            events={eventRows}
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

  const loaded = await loadAdminEventsIndex(ctx, {
    tab: sp.tab,
    page: sp.page,
    q: sp.q,
  })

  if (!loaded.ok) {
    return (
      <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-10'>
        <AdminEventsIndexHeader isOps={isOps} />
        <AdminEventsIndexToolbar
          key={`events-idx-toolbar-${tab}-cards`}
          tab={tab}
          viewMode='cards'
          isOps={isOps}
          searchQuery={q}
        />
        <Alert variant='destructive'>
          <AlertTitle>Gagal memuat data</AlertTitle>
          <AlertDescription>
            Terjadi kesalahan saat memuat acara dari basis data. Silakan muat ulang halaman beberapa saat lagi.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const { events, pendingReviewRecapTotal, page, pageSize, totalItems } = loaded

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-8 lg:py-10'>
      <AdminEventsIndexHeader isOps={isOps} />

      <AdminEventsIndexToolbar
        key={`events-idx-toolbar-${tab}-cards`}
        tab={tab}
        viewMode='cards'
        isOps={isOps}
        searchQuery={q}
      />

      <AdminEventsPendingReviewAlert pendingReviewRecapTotal={pendingReviewRecapTotal} />

      <AdminEventsCardsView
        tab={tab}
        searchQuery={q}
        events={events}
        showEventSettingsLink={isOps}
        pagination={{ page, pageSize, totalItems }}
      />
    </main>
  )
}
