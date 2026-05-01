import type { EventStatus } from "@prisma/client";

export type DashboardEventTab = "all" | "active" | "draft" | "finished";

export type DashboardEventRow = {
  id: string;
  title: string;
  status: EventStatus;
  startAt: Date;
  venueName: string;
};

export type AdminDashboardEventCard = DashboardEventRow & {
  pendingReview: number;
  approved: number;
  total: number;
};

const STATUS_ORDER: Record<EventStatus, number> = {
  active: 0,
  draft: 1,
  finished: 2,
};

export function parseDashboardEventTab(
  raw: string | string[] | undefined,
): DashboardEventTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "all" || v === "active" || v === "draft" || v === "finished") {
    return v;
  }
  return "active";
}

export function groupByResultToCountMap(
  rows: { eventId: string; count: number }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.eventId] = row.count;
  }
  return out;
}

export function buildDashboardEventCards(
  events: DashboardEventRow[],
  pendingByEventId: Record<string, number>,
  approvedByEventId: Record<string, number>,
  totalByEventId: Record<string, number>,
): AdminDashboardEventCard[] {
  return events.map((e) => ({
    ...e,
    pendingReview: pendingByEventId[e.id] ?? 0,
    approved: approvedByEventId[e.id] ?? 0,
    total: totalByEventId[e.id] ?? 0,
  }));
}

export function sortDashboardEventCards(
  cards: AdminDashboardEventCard[],
): AdminDashboardEventCard[] {
  return [...cards].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.startAt.getTime() - b.startAt.getTime();
  });
}

export function filterDashboardCardsByTab(
  cards: AdminDashboardEventCard[],
  tab: DashboardEventTab,
): AdminDashboardEventCard[] {
  if (tab === "all") return cards;
  return cards.filter((c) => c.status === tab);
}

export function sumPendingReviewForCards(
  cards: AdminDashboardEventCard[],
): number {
  return cards.reduce((acc, c) => acc + c.pendingReview, 0);
}
