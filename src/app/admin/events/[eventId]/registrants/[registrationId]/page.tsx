import { InvoiceAdjustmentStatus } from '@prisma/client'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { RegistrationDetailShell } from '@/components/admin/registration-detail-panels/registration-detail-shell'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import {
  buildRegistrationDetailPath,
  defaultRegistrationDetailTab,
  parseRegistrationDetailTab,
} from '@/lib/admin/event-registration-detail-tab'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { flattenedMenuRowsFromEventVenueLinks } from '@/lib/events/flatten-event-venue-menu'
import { canVerifyEvent } from '@/lib/permissions/guards'
import type { TicketContextVm } from '@/lib/registrations/admin-ticket-context'
import { loadTicketContextVm } from '@/lib/registrations/load-admin-ticket-context'
import { loadClubWaTemplateBodies } from '@/lib/wa-templates/load-club-wa-templates'

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const { eventId } = await params
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true },
  })
  return { title: event ? `Registrasi · ${event.title}` : 'Registrasi' }
}

function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined
  if (Array.isArray(param)) return param[0]
  return param
}

function tabParamMissing(param: string | string[] | undefined): boolean {
  return param === undefined || param === '' || (Array.isArray(param) && (param.length === 0 || param[0] === ''))
}

export default async function AdminEventRegistrantsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string; registrationId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { eventId, registrationId } = await params
  const sp = (await searchParams) ?? {}

  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)

  if (!ctx) {
    return (
      <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 pb-10 pt-4'>
        <h1 className='text-2xl font-semibold tracking-tight'>Detail pendaftar</h1>
        <div className='rounded-lg border border-dashed bg-card p-4 md:p-6 text-sm'>Missing AdminProfile</div>
      </main>
    )
  }

  if (!canVerifyEvent(ctx, eventId)) notFound()

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, eventId },
    select: {
      id: true,
      createdAt: true,
      contactName: true,
      contactWhatsapp: true,
      contactEmail: true,
      computedTotalAtSubmit: true,
      ticketQty: true,
      ticketCategoryId: true,
      ticketCategory: {
        select: {
          id: true,
          name: true,
          regularPrice: true,
          memberPrice: true,
        },
      },
      holders: {
        orderBy: { sortOrder: 'asc' as const },
        select: {
          id: true,
          sortOrder: true,
          holderName: true,
          holderEmail: true,
          claimedMemberNumber: true,
          memberValidation: true,
          memberType: true,
          ticketPriceApplied: true,
          mandatoryMenuItem: { select: { name: true } },
        },
      },
      status: true,
      attendanceStatus: true,
      rejectionReason: true,
      paymentIssueReason: true,
      event: {
        select: {
          id: true,
          title: true,
          kickOffAt: true,
          venue: { select: { name: true } },
          eventVenueMenuItems: {
            include: { venueMenuItem: true },
          },
          bankAccount: {
            select: { bankName: true, accountNumber: true, accountName: true },
          },
        },
      },
      uploads: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          purpose: true,
          blobUrl: true,
          contentType: true,
          bytes: true,
          width: true,
          height: true,
          originalFilename: true,
          createdAt: true,
          registrationHolderId: true,
        },
      },
      adjustments: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          uploads: {
            select: { id: true, blobUrl: true, bytes: true, createdAt: true },
          },
        },
      },
    },
  })

  if (!registration) notFound()

  const hasUnpaidAdjustment = registration.adjustments.some(a => a.status === InvoiceAdjustmentStatus.unpaid)

  const fallbackTab = defaultRegistrationDetailTab({
    status: registration.status,
    hasUnpaidAdjustment,
  })

  if (tabParamMissing(sp.tab)) {
    redirect(buildRegistrationDetailPath(eventId, registrationId, fallbackTab))
  }

  const rawTab = firstString(sp.tab)
  const parsedTab = parseRegistrationDetailTab(rawTab)
  if (parsedTab === null) {
    redirect(buildRegistrationDetailPath(eventId, registrationId, fallbackTab))
  }

  const detailTab = parsedTab

  const { event: prismaEvent, ...registrationRest } = registration

  const registrationForDetail: DetailRegistration = {
    ...registrationRest,
    holders: registration.holders.map(h => ({
      id: h.id,
      sortOrder: h.sortOrder,
      holderName: h.holderName,
      holderEmail: h.holderEmail,
      claimedMemberNumber: h.claimedMemberNumber,
      memberValidation: h.memberValidation,
      memberType: h.memberType,
      ticketPriceApplied: h.ticketPriceApplied,
      menuItemName: h.mandatoryMenuItem?.name ?? null,
    })),
    event: {
      id: prismaEvent.id,
      title: prismaEvent.title,
      venueName: prismaEvent.venue.name,
      kickOffAt: prismaEvent.kickOffAt,
      menuItems: flattenedMenuRowsFromEventVenueLinks(prismaEvent.eventVenueMenuItems),
      bankAccount: prismaEvent.bankAccount,
    },
  }

  let ticketContext: TicketContextVm
  try {
    ticketContext = await loadTicketContextVm({
      eventId,
      registration: {
        id: registration.id,
        holders: registration.holders,
      },
    })
  } catch {
    ticketContext = {
      kind: 'error',
      message: 'Tidak dapat memuat konteks kursi.',
    }
  }

  const waBodies = await loadClubWaTemplateBodies()

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 pb-10 pt-4'>
      <RegistrationDetailShell
        eventId={eventId}
        tab={detailTab}
        registration={registrationForDetail}
        ticketContext={ticketContext}
        waBodies={waBodies}
        showOperasiBadge={hasUnpaidAdjustment}
      />
    </main>
  )
}
