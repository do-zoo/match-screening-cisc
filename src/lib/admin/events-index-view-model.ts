import type { EventStatus } from "@prisma/client";

export type EventsIndexStatusTab = "all" | "active" | "draft" | "finished";

export type AdminEventIndexRow = {
  id: string;
  slug: string;
  title: string;
  status: EventStatus;
  startAt: Date;
  venueName: string;
};

/** Satu acara pada indeks admin beserta agregat registrasi (tampilan kartu). */
export type AdminEventSummary = AdminEventIndexRow & {
  pendingReview: number;
  approved: number;
  total: number;
};

const STATUS_ORDER: Record<EventStatus, number> = {
  active: 0,
  draft: 1,
  finished: 2,
};

export function parseEventsIndexStatusTab(
  raw: string | string[] | undefined,
): EventsIndexStatusTab {
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

export function buildAdminEventSummaries(
  events: AdminEventIndexRow[],
  pendingByEventId: Record<string, number>,
  approvedByEventId: Record<string, number>,
  totalByEventId: Record<string, number>,
): AdminEventSummary[] {
  return events.map((e) => ({
    ...e,
    pendingReview: pendingByEventId[e.id] ?? 0,
    approved: approvedByEventId[e.id] ?? 0,
    total: totalByEventId[e.id] ?? 0,
  }));
}

export function sortAdminEventSummaries(
  items: AdminEventSummary[],
): AdminEventSummary[] {
  return [...items].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.startAt.getTime() - b.startAt.getTime();
  });
}

export function filterAdminEventSummariesByTab(
  items: AdminEventSummary[],
  tab: EventsIndexStatusTab,
): AdminEventSummary[] {
  if (tab === "all") return items;
  return items.filter((c) => c.status === tab);
}

export function filterAdminEventSummariesBySearch(
  items: AdminEventSummary[],
  raw: string,
): AdminEventSummary[] {
  const q = raw.trim().toLowerCase();
  if (!q) return items;
  return items.filter((e) => {
    const title = e.title.toLowerCase();
    const slug = e.slug.toLowerCase();
    const venue = e.venueName.toLowerCase();
    return title.includes(q) || slug.includes(q) || venue.includes(q);
  });
}

export function sumPendingReviewForSummaries(
  items: AdminEventSummary[],
): number {
  return items.reduce((acc, c) => acc + c.pendingReview, 0);
}
