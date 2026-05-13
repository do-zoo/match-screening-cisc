import type { AdminContext } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { canVerifyEvent } from "@/lib/permissions/guards";
import { hasGlobalVerifierAccess } from "@/lib/permissions/roles";
import {
  ADMIN_TABLE_PAGE_SIZE,
  parseAdminTablePage,
  resolveClampedPage,
} from "@/lib/table/admin-pagination";

import {
  buildAdminEventSummaries,
  filterAdminEventSummariesBySearch,
  filterAdminEventSummariesByTab,
  groupByResultToCountMap,
  parseEventsIndexStatusTab,
  sortAdminEventSummaries,
  sumPendingReviewForSummaries,
  type AdminEventSummary,
  type EventsIndexStatusTab,
} from "./events-index-view-model";
import { parseEventsIndexSearchQuery } from "./events-index-view";

export type LoadAdminEventsIndexResult =
  | {
      ok: true;
      tab: EventsIndexStatusTab;
      page: number;
      pageSize: number;
      totalItems: number;
      events: AdminEventSummary[];
      pendingReviewRecapTotal: number;
    }
  | { ok: false; error: "database" };

function collectAuthorizedEventRows(ctx: AdminContext) {
  if (hasGlobalVerifierAccess(ctx.role)) {
    return prisma.event.findMany({
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        kickOffAt: true,
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
      slug: true,
      title: true,
      status: true,
      kickOffAt: true,
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
 * Indeks acara (tampilan kartu): acara yang boleh diverifikasi + KPI registrasi,
 * difilter status (`tab`) dan teks (`q`), dipaginasi di memori setelah sort.
 */
export async function loadAdminEventsIndex(
  ctx: AdminContext,
  opts?: {
    tab?: string | string[];
    page?: string | string[];
    q?: string | string[];
  },
): Promise<LoadAdminEventsIndexResult> {
  const tab = parseEventsIndexStatusTab(opts?.tab);
  const search = parseEventsIndexSearchQuery(opts?.q);
  const requestedPage = parseAdminTablePage(opts?.page);
  const pageSize = ADMIN_TABLE_PAGE_SIZE;

  try {
    const rawEvents = await collectAuthorizedEventRows(ctx);
    const visible = rawEvents.filter((e) => canVerifyEvent(ctx, e.id));
    const eventIds = visible.map((e) => e.id);

    const counts = await fetchRegistrationCountsByEvent(eventIds);

    const summaries = sortAdminEventSummaries(
      buildAdminEventSummaries(
        visible.map((e) => ({
          id: e.id,
          slug: e.slug,
          title: e.title,
          status: e.status,
          startAt: e.kickOffAt,
          venueName: e.venue.name,
        })),
        counts.pendingReviewByEventId,
        counts.approvedByEventId,
        counts.totalByEventId,
      ),
    );

    const byTab = filterAdminEventSummariesByTab(summaries, tab);
    const filtered = filterAdminEventSummariesBySearch(byTab, search);
    const totalItems = filtered.length;
    const page = resolveClampedPage(requestedPage, totalItems, pageSize);
    const skip = (page - 1) * pageSize;
    const events = filtered.slice(skip, skip + pageSize);

    return {
      ok: true,
      tab,
      page,
      pageSize,
      totalItems,
      events,
      pendingReviewRecapTotal: sumPendingReviewForSummaries(filtered),
    };
  } catch {
    return { ok: false, error: "database" };
  }
}
