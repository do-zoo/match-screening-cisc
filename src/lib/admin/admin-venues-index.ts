import type { EventsIndexViewMode } from '@/lib/admin/events-index-view'
import { parseEventsIndexSearchQuery, parseEventsIndexViewParam } from '@/lib/admin/events-index-view'
import { parseAdminTablePage } from '@/lib/table/admin-pagination'

export type VenuesIndexTab = 'all' | 'active' | 'inactive'

export function parseVenuesIndexTab(raw: string | string[] | undefined): VenuesIndexTab {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'active') return 'active'
  if (v === 'inactive') return 'inactive'
  return 'all'
}

export function parseVenuesIndexSearchParams(sp: Record<string, string | string[] | undefined>): {
  tab: VenuesIndexTab
  q: string
  view: EventsIndexViewMode
  page: number
} {
  return {
    tab: parseVenuesIndexTab(sp.tab),
    q: parseEventsIndexSearchQuery(sp.q),
    view: parseEventsIndexViewParam(sp.view),
    page: parseAdminTablePage(sp.page),
  }
}

/** URL indeks venue (`?tab=`, `?view=tabel`, `?q=`, `?page=`). */
export function buildAdminVenuesIndexUrl(opts: {
  tab: VenuesIndexTab
  view: EventsIndexViewMode
  q?: string
  page?: number
}): string {
  const p = new URLSearchParams()
  p.set('tab', opts.tab)
  if (opts.view === 'table') p.set('view', 'tabel')
  const qq = opts.q?.trim()
  if (qq) p.set('q', qq)
  if (opts.page !== undefined && opts.page > 1) {
    p.set('page', String(opts.page))
  }
  const s = p.toString()
  return s ? `/admin/venues?${s}` : '/admin/venues'
}
