import { parseEventsIndexSearchQuery, parseEventsIndexViewParam } from '@/lib/admin/events-index-view'
import type { EventsIndexViewMode } from '@/lib/admin/events-index-view'
import { buildAdminListUrl } from '@/lib/admin/admin-list-url'
import { parseAdminTablePage } from '@/lib/table/admin-pagination'

export type VenueMenuListViewMode = EventsIndexViewMode

/** Filter baris menu venue: semua / hanya terkunci / hanya belum terkunci. */
export type VenueMenuLockFilter = 'all' | 'locked' | 'unlocked'

export function parseVenueMenuLockFilter(raw: string | string[] | undefined): VenueMenuLockFilter {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'locked' || v === 'terkunci') return 'locked'
  if (v === 'unlocked' || v === 'bebas') return 'unlocked'
  return 'all'
}

export function parseVenueMenuListSearchParams(sp: Record<string, string | string[] | undefined>): {
  q: string
  view: VenueMenuListViewMode
  page: number
  filter: VenueMenuLockFilter
} {
  return {
    q: parseEventsIndexSearchQuery(sp.q),
    view: parseEventsIndexViewParam(sp.view),
    page: parseAdminTablePage(sp.page),
    filter: parseVenueMenuLockFilter(sp.filter),
  }
}

export function buildAdminVenueMenuListUrl(
  venueId: string,
  opts: {
    q?: string
    view?: VenueMenuListViewMode
    page?: number
    filter?: VenueMenuLockFilter
  },
): string {
  const pathname = `/admin/venues/${venueId}/menu`
  const qq = opts.q?.trim()
  const entries: Record<string, string | undefined> = {}
  if (qq) entries.q = qq
  if (opts.view === 'table') entries.view = 'tabel'
  if (opts.page !== undefined && opts.page > 1) {
    entries.page = String(opts.page)
  }
  if (opts.filter && opts.filter !== 'all') {
    entries.filter = opts.filter
  }
  return buildAdminListUrl(pathname, entries)
}
