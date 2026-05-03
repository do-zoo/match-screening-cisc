import type { AdminContext } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { canVerifyEvent } from "@/lib/permissions/guards";
import { hasGlobalVerifierAccess } from "@/lib/permissions/roles";

import {
  buildDashboardEventCards,
  filterDashboardCardsByTab,
  type AdminDashboardEventCard,
  type DashboardEventTab,
  groupByResultToCountMap,
  parseDashboardEventTab,
  sortDashboardEventCards,
  sumPendingReviewForCards,
} from "./dashboard-view-model";

export type LoadAdminDashboardResult =
  | {
      ok: true;
      tab: DashboardEventTab;
      events: AdminDashboardEventCard[];
      pendingReviewRecapTotal: number;
    }
  | { ok: false; error: "database" };

function collectAuthorizedEventRows(ctx: AdminContext) {
  if (hasGlobalVerifierAccess(ctx.role)) {
    return prisma.event.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        startAt: true,
        venue: { select: { name: true } },
      },
    });
  }
  const ids = ctx.helperEventIds;
  if (ids.length === 0) {
    return Promise.resolve([]);
  }
  return prisma.event.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      status: true,
      startAt: true,
      venue: { select: { name: true } },
    },
  });
}

async function fetchRegistrationCountsByEvent(eventIds: string[]) {
  if (eventIds.length === 0) {
    return {
      pendingReviewByEventId: {} as Record<string, number>,
      approvedByEventId: {} as Record<string, number>,
      totalByEventId: {} as Record<string, number>,
    };
  }

  const inList = { in: eventIds };

  const [pendingGroups, approvedGroups, totalGroups] = await Promise.all([
    prisma.registration.groupBy({
      by: ["eventId"],
      where: { eventId: inList, status: "pending_review" },
      _count: { _all: true },
    }),
    prisma.registration.groupBy({
      by: ["eventId"],
      where: { eventId: inList, status: "approved" },
      _count: { _all: true },
    }),
    prisma.registration.groupBy({
      by: ["eventId"],
      where: { eventId: inList },
      _count: { _all: true },
    }),
  ]);

  return {
    pendingReviewByEventId: groupByResultToCountMap(
      pendingGroups.map((g) => ({ eventId: g.eventId, count: g._count._all })),
    ),
    approvedByEventId: groupByResultToCountMap(
      approvedGroups.map((g) => ({ eventId: g.eventId, count: g._count._all })),
    ),
    totalByEventId: groupByResultToCountMap(
      totalGroups.map((g) => ({ eventId: g.eventId, count: g._count._all })),
    ),
  };
}

/**
 * Loads authorized events + registration KPIs for the admin dashboard (single Prisma cluster; no per-card N+1).
 */
export async function loadAdminDashboard(
  ctx: AdminContext,
  opts?: { tab?: string | string[] },
): Promise<LoadAdminDashboardResult> {
  const tab = parseDashboardEventTab(opts?.tab);

  try {
    const rawEvents = await collectAuthorizedEventRows(ctx);
    const visible = rawEvents.filter((e) => canVerifyEvent(ctx, e.id));
    const eventIds = visible.map((e) => e.id);

    const counts = await fetchRegistrationCountsByEvent(eventIds);

    const cards = sortDashboardEventCards(
      buildDashboardEventCards(
        visible.map((e) => ({
          id: e.id,
          title: e.title,
          status: e.status,
          startAt: e.startAt,
          venueName: e.venue.name,
        })),
        counts.pendingReviewByEventId,
        counts.approvedByEventId,
        counts.totalByEventId,
      ),
    );

    const filtered = filterDashboardCardsByTab(cards, tab);

    return {
      ok: true,
      tab,
      events: filtered,
      pendingReviewRecapTotal: sumPendingReviewForCards(filtered),
    };
  } catch {
    return { ok: false, error: "database" };
  }
}
