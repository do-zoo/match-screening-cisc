import {
  RegistrationStatus,
  AttendanceStatus,
  InvoiceAdjustmentStatus,
  TicketRole,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ParticipantStats = {
  total: number;
  byStatus: Partial<Record<RegistrationStatus, number>>;
  memberCount: number;
  nonMemberCount: number;
  partnerCount: number;
};

export type FinanceStats = {
  baselineTotal: number; // sum of computedTotalAtSubmit for approved registrations
  adjustmentsPaidTotal: number;
  adjustmentsUnpaidTotal: number;
  refundCount: number;
};

export type MenuStats =
  | { mode: "PRESELECT"; byItem: { name: string; count: number }[] }
  | { mode: "VOUCHER"; redeemed: number; notRedeemed: number };

export type AttendanceStats = {
  attended: number;
  noShow: number;
  unknown: number;
};

export type EventReport = {
  eventId: string;
  participant: ParticipantStats;
  finance: FinanceStats;
  menu: MenuStats;
  attendance: AttendanceStats;
};

export async function getEventReport(eventId: string): Promise<EventReport> {
  const [
    statusGroups,
    memberCount,
    partnerCount,
    financeAgg,
    adjustmentGroups,
    refundCount,
    attendanceGroups,
    event,
    menuSelections,
    ticketVoucherCounts,
  ] = await Promise.all([
    prisma.registration.groupBy({
      by: ["status"],
      where: { eventId },
      _count: { id: true },
    }),
    prisma.registration.count({
      where: { eventId, claimedMemberNumber: { not: null } },
    }),
    prisma.ticket.count({
      where: { eventId, role: TicketRole.partner },
    }),
    // "attended" is not a RegistrationStatus — attendance is tracked separately
    // via attendanceStatus. Finance baseline covers all approved registrations.
    prisma.registration.aggregate({
      where: { eventId, status: RegistrationStatus.approved },
      _sum: { computedTotalAtSubmit: true },
    }),
    prisma.invoiceAdjustment.groupBy({
      by: ["status"],
      where: { registration: { eventId } },
      _sum: { amount: true },
    }),
    prisma.registration.count({
      where: { eventId, status: RegistrationStatus.refunded },
    }),
    prisma.registration.groupBy({
      by: ["attendanceStatus"],
      where: { eventId },
      _count: { id: true },
    }),
    prisma.event.findUnique({
      where: { id: eventId },
      select: { menuMode: true },
    }),
    prisma.ticketMenuSelection.groupBy({
      by: ["menuItemId"],
      where: { ticket: { eventId } },
      _count: { ticketId: true },
    }),
    prisma.ticket.count({
      where: { eventId, voucherRedeemedMenuItemId: { not: null } },
    }),
  ]);

  const total = statusGroups.reduce((s, g) => s + g._count.id, 0);
  const byStatus: Partial<Record<RegistrationStatus, number>> = {};
  for (const g of statusGroups) {
    byStatus[g.status] = g._count.id;
  }

  const nonMemberCount = total - memberCount;

  const adjustmentPaidRow = adjustmentGroups.find(
    (g) => g.status === InvoiceAdjustmentStatus.paid,
  );
  const adjustmentUnpaidRow = adjustmentGroups.find(
    (g) => g.status === InvoiceAdjustmentStatus.unpaid,
  );

  const attendanceMap: Partial<Record<AttendanceStatus, number>> = {};
  for (const g of attendanceGroups) {
    attendanceMap[g.attendanceStatus] = g._count.id;
  }

  // Build menu stats
  let menu: MenuStats;
  if (event?.menuMode === "VOUCHER") {
    const totalTickets = await prisma.ticket.count({ where: { eventId } });
    menu = {
      mode: "VOUCHER",
      redeemed: ticketVoucherCounts,
      notRedeemed: totalTickets - ticketVoucherCounts,
    };
  } else {
    // Fetch menu item names for PRESELECT
    const itemIds = menuSelections.map((s) => s.menuItemId);
    const items = itemIds.length
      ? await prisma.eventMenuItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = Object.fromEntries(items.map((i) => [i.id, i.name]));
    menu = {
      mode: "PRESELECT",
      byItem: menuSelections.map((s) => ({
        name: nameById[s.menuItemId] ?? s.menuItemId,
        count: s._count.ticketId,
      })),
    };
  }

  return {
    eventId,
    participant: {
      total,
      byStatus,
      memberCount,
      nonMemberCount,
      partnerCount,
    },
    finance: {
      baselineTotal: financeAgg._sum.computedTotalAtSubmit ?? 0,
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
  };
}
