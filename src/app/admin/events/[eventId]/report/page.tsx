import {
  EventReportAttendancePanel,
  EventReportFinancePanel,
  EventReportMenuPanel,
  EventReportParticipantsPanel,
} from '@/components/admin/event-report-panels'
import { EventSettlementProofsPanel } from '@/components/admin/event-settlement-proofs-panel'
import { buttonVariants } from '@/components/ui/button'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { canVerifyEvent } from '@/lib/permissions/guards'
import { hasOperationalOwnerParity } from '@/lib/permissions/roles'
import { getEventReport } from '@/lib/reports/queries'
import { getSettlementExpectedAmounts } from '@/lib/reports/settlement-expected-amounts'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const { eventId } = await params
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true },
  })
  return { title: event ? `Laporan · ${event.title}` : 'Laporan' }
}

export default async function EventReportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params

  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)
  if (!ctx) notFound()
  if (!canVerifyEvent(ctx, eventId)) notFound()

  const [event, report, artifacts] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, status: true, picAdminProfileId: true },
    }),
    getEventReport(eventId),
    prisma.eventSettlementArtifact.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      include: {
        upload: { select: { blobUrl: true } },
        uploadedBy: { select: { authUserId: true } },
      },
    }),
  ])

  if (!event) notFound()

  const authUserIds = [...new Set(artifacts.map(a => a.uploadedBy.authUserId))]
  const users =
    authUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: authUserIds } },
          select: { id: true, name: true, email: true },
        })
      : []
  const labelByAuthId = Object.fromEntries(users.map(u => [u.id, u.name?.trim() || u.email]))

  const settlementRows = artifacts.map(a => ({
    id: a.id,
    kind: a.kind,
    declaredAmountIdr: a.declaredAmountIdr,
    expectedAmountIdr: a.expectedAmountIdr,
    amountDeltaIdr: a.amountDeltaIdr,
    mismatchAcknowledged: a.mismatchAcknowledged,
    mismatchReason: a.mismatchReason,
    createdAt: a.createdAt.toISOString(),
    blobUrl: a.upload.blobUrl,
    uploaderLabel: labelByAuthId[a.uploadedBy.authUserId] ?? a.uploadedBy.authUserId,
  }))

  const expectedSettlement = getSettlementExpectedAmounts({
    baselineTotalApproved: report.finance.baselineTotal,
    menuVenuePayoutApproved: report.finance.menuVenuePayoutApproved,
    adjustmentsPaidTotal: report.finance.adjustmentsPaidTotal,
  })

  const canManageSettlement = ctx.profileId === event.picAdminProfileId || hasOperationalOwnerParity(ctx.role)

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 pb-10 pt-4'>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Laporan acara</h1>
          <p className='text-sm text-muted-foreground'>{event.title}</p>
        </div>
        <Link
          href={`/admin/events/${eventId}/report/export`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
        >
          Unduh CSV
        </Link>
      </header>

      <EventReportParticipantsPanel participant={report.participant} />
      <EventReportFinancePanel finance={report.finance} />

      <EventSettlementProofsPanel
        eventId={eventId}
        canManage={canManageSettlement}
        expectedVenueMenuPayout={expectedSettlement.venueMenuPayout}
        expectedTreasurerMargin={expectedSettlement.treasurerMargin}
        artifacts={settlementRows}
      />

      <EventReportMenuPanel menu={report.menu} />
      <EventReportAttendancePanel attendance={report.attendance} />
    </main>
  )
}
