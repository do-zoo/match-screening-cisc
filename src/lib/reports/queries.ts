import { RegistrationStatus, AttendanceStatus, InvoiceAdjustmentStatus, MemberValidation } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type ParticipantStats = {
  total: number
  byStatus: Partial<Record<RegistrationStatus, number>>
  memberCount: number
  nonMemberCount: number
  holderCount: number
}

export type FinanceStats = {
  baselineTotal: number
  ticketRevenueApproved: number
  /** Agregat harga menu wajib (approved): dana yang disetor ke venue, bukan pendapatan retensi komite. */
  menuVenuePayoutApproved: number
  adjustmentsPaidTotal: number
  adjustmentsUnpaidTotal: number
  refundCount: number
}

export type MenuStats = {
  byItem: { name: string; count: number }[]
}

export type AttendanceStats = {
  attended: number
  noShow: number
  unknown: number
}

export type EventReport = {
  eventId: string
  participant: ParticipantStats
  finance: FinanceStats
  menu: MenuStats
  attendance: AttendanceStats
}

export async function getEventReport(eventId: string): Promise<EventReport> {
  const [
    statusGroups,
    memberCount,
    holderCount,
    financeAgg,
    ticketRevAgg,
    menuRevAgg,
    adjustmentGroups,
    refundCount,
    attendanceGroups,
    holderMenuGroups,
  ] = await Promise.all([
    prisma.registration.groupBy({
      by: ['status'],
      where: { eventId },
      _count: { id: true },
    }),
    prisma.registrationHolder.count({
      where: {
        registration: { eventId },
        memberValidation: { in: [MemberValidation.valid, MemberValidation.overridden] },
      },
    }),
    prisma.registrationHolder.count({
      where: { registration: { eventId } },
    }),
    prisma.registration.aggregate({
      where: { eventId, status: RegistrationStatus.approved },
      _sum: { computedTotalAtSubmit: true },
    }),
    prisma.registrationTicket.aggregate({
      where: { registration: { eventId, status: RegistrationStatus.approved } },
      _sum: { ticketPriceApplied: true },
    }),
    prisma.registrationTicket.aggregate({
      where: { registration: { eventId, status: RegistrationStatus.approved } },
      _sum: { mandatoryMenuPriceApplied: true },
    }),
    prisma.invoiceAdjustment.groupBy({
      by: ['status'],
      where: { registration: { eventId } },
      _sum: { amount: true },
    }),
    prisma.registration.count({
      where: { eventId, status: RegistrationStatus.refunded },
    }),
    prisma.registration.groupBy({
      by: ['attendanceStatus'],
      where: { eventId },
      _count: { id: true },
    }),
    prisma.registrationTicket.groupBy({
      by: ['mandatoryMenuItemId'],
      where: { registration: { eventId } },
      _count: { id: true },
    }),
  ])

  const total = statusGroups.reduce((s, g) => s + g._count.id, 0)
  const byStatus: Partial<Record<RegistrationStatus, number>> = {}
  for (const g of statusGroups) {
    byStatus[g.status] = g._count.id
  }

  const nonMemberCount = holderCount - memberCount

  const adjustmentPaidRow = adjustmentGroups.find(g => g.status === InvoiceAdjustmentStatus.paid)
  const adjustmentUnpaidRow = adjustmentGroups.find(g => g.status === InvoiceAdjustmentStatus.unpaid)

  const attendanceMap: Partial<Record<AttendanceStatus, number>> = {}
  for (const g of attendanceGroups) {
    attendanceMap[g.attendanceStatus] = g._count.id
  }

  const menuItemIds = holderMenuGroups.map(s => s.mandatoryMenuItemId).filter((id): id is string => id !== null)
  const menuItems = menuItemIds.length
    ? await prisma.venueMenuItem.findMany({
        where: { id: { in: menuItemIds } },
        select: { id: true, name: true },
      })
    : []
  const menuNameById = Object.fromEntries(menuItems.map(i => [i.id, i.name]))

  const menu: MenuStats = {
    byItem: holderMenuGroups
      .filter(s => s.mandatoryMenuItemId !== null)
      .map(s => ({
        name: menuNameById[s.mandatoryMenuItemId!] ?? s.mandatoryMenuItemId!,
        count: s._count.id,
      })),
  }

  return {
    eventId,
    participant: {
      total,
      byStatus,
      memberCount,
      nonMemberCount,
      holderCount,
    },
    finance: {
      baselineTotal: financeAgg._sum.computedTotalAtSubmit ?? 0,
      ticketRevenueApproved: ticketRevAgg._sum.ticketPriceApplied ?? 0,
      menuVenuePayoutApproved: menuRevAgg._sum.mandatoryMenuPriceApplied ?? 0,
      adjustmentsPaidTotal: adjustmentPaidRow?._sum.amount ?? 0,
      adjustmentsUnpaidTotal: adjustmentUnpaidRow?._sum.amount ?? 0,
      refundCount,
    },
    menu,
    attendance: {
      attended: attendanceMap[AttendanceStatus.attended] ?? 0,
      noShow: attendanceMap[AttendanceStatus.no_show] ?? 0,
      unknown: attendanceMap[AttendanceStatus.unknown] ?? 0,
    },
  }
}
