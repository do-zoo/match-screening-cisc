import type { Prisma, RegistrationStatus } from "@prisma/client";

import { buildAdminListUrl } from "@/lib/admin/admin-list-url";
import { eventRegistrantsListPath } from "@/lib/admin/event-registrants-paths";
import type { EventsIndexViewMode } from "@/lib/admin/events-index-view";
import {
  parseEventsIndexSearchQuery,
  parseEventsIndexViewParam,
} from "@/lib/admin/events-index-view";

export type EventRegistrantsTab =
  | "all"
  | "pending_review"
  | "submitted"
  | "payment_issue"
  | "approved"
  | "rejected"
  | "closed";

const TABS = new Set<EventRegistrantsTab>([
  "all",
  "pending_review",
  "submitted",
  "payment_issue",
  "approved",
  "rejected",
  "closed",
]);

export function parseEventRegistrantsTab(
  raw: string | string[] | undefined,
): EventRegistrantsTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && TABS.has(v as EventRegistrantsTab)) return v as EventRegistrantsTab;
  return "all";
}

export function parseEventRegistrantsSearchQuery(
  raw: string | string[] | undefined,
): string {
  return parseEventsIndexSearchQuery(raw);
}

export function parseEventRegistrantsViewParam(
  raw: string | string[] | undefined,
): EventsIndexViewMode {
  return parseEventsIndexViewParam(raw);
}

export function registrationListWhere(
  eventId: string,
  tab: EventRegistrantsTab,
  q: string,
): Prisma.RegistrationWhereInput {
  const and: Prisma.RegistrationWhereInput[] = [{ eventId }];

  if (tab !== "all") {
    if (tab === "closed") {
      and.push({ status: { in: ["cancelled", "refunded"] } });
    } else {
      and.push({ status: tab as RegistrationStatus });
    }
  }

  const trimmed = q.trim();
  if (trimmed.length > 0) {
    and.push({
      OR: [
        { contactName: { contains: trimmed, mode: "insensitive" } },
        { contactWhatsapp: { contains: trimmed, mode: "insensitive" } },
        {
          claimedMemberNumber: {
            contains: trimmed,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  return and.length === 1 ? and[0]! : { AND: and };
}

export function buildEventRegistrantsListUrl(
  eventId: string,
  opts: {
    tab: EventRegistrantsTab;
    view: EventsIndexViewMode;
    q?: string;
    page?: number;
  },
): string {
  const pathname = eventRegistrantsListPath(eventId);
  const entries: Record<string, string | undefined> = {};
  if (opts.tab !== "all") entries.tab = opts.tab;
  if (opts.view === "table") entries.view = "tabel";
  const qq = opts.q?.trim();
  if (qq) entries.q = qq;
  if (opts.page !== undefined && opts.page > 1) {
    entries.page = String(opts.page);
  }
  return buildAdminListUrl(pathname, entries);
}

/** Query string untuk `TablePagination.preservedQuery`. */
export function eventRegistrantsListPreservedQuery(opts: {
  tab: EventRegistrantsTab;
  view: EventsIndexViewMode;
  q: string;
}): Record<string, string | undefined> {
  return {
    ...(opts.tab !== "all" ? { tab: opts.tab } : {}),
    ...(opts.view === "table" ? { view: "tabel" } : {}),
    ...(opts.q.trim() ? { q: opts.q.trim() } : {}),
  };
}
