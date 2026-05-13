import type { EventsIndexStatusTab } from "@/lib/admin/events-index-view-model";

export type EventsIndexViewMode = "cards" | "table";

export function parseEventsIndexViewParam(
  raw: string | string[] | undefined,
): EventsIndexViewMode {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "tabel" || v === "table") return "table";
  return "cards";
}

/** Kueri teks `?q=` untuk judul/slug/venue (dibatasi panjang). */
export function parseEventsIndexSearchQuery(
  raw: string | string[] | undefined,
): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined || typeof v !== "string") return "";
  return v.trim().slice(0, 200);
}

export function buildAdminEventsIndexUrl(opts: {
  tab: EventsIndexStatusTab;
  view: EventsIndexViewMode;
  q?: string;
  page?: number;
}): string {
  const p = new URLSearchParams();
  p.set("tab", opts.tab);
  if (opts.view === "table") p.set("view", "tabel");
  const qq = opts.q?.trim();
  if (qq) p.set("q", qq);
  if (opts.page !== undefined && opts.page > 1) {
    p.set("page", String(opts.page));
  }
  const s = p.toString();
  return s ? `/admin/events?${s}` : "/admin/events";
}
