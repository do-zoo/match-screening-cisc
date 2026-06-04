import { parseEventsIndexSearchQuery } from '@/lib/admin/events-index-view'
import type { PeriodAssignmentAdminFilter } from '@/lib/management/query-admin-period-assignments'
import { parseAdminTablePage } from '@/lib/table/admin-pagination'

export function parsePeriodAssignmentAdminFilter(
  raw: string | string[] | undefined,
): PeriodAssignmentAdminFilter {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'linked' || v === 'unlinked') return v
  return 'all'
}

export function parsePeriodAssignmentsView(
  raw: string | string[] | undefined,
): 'list' | 'tree' {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === 'tree' ? 'tree' : 'list'
}

export function parseAdminPeriodAssignmentsSearchParams(
  sp: Record<string, string | string[] | undefined>,
): {
  filter: PeriodAssignmentAdminFilter
  q: string
  page: number
  view: 'list' | 'tree'
} {
  return {
    filter: parsePeriodAssignmentAdminFilter(sp.filter),
    q: parseEventsIndexSearchQuery(sp.q),
    page: parseAdminTablePage(sp.page),
    view: parsePeriodAssignmentsView(sp.view),
  }
}

export function buildAdminPeriodAssignmentsListUrl(
  periodId: string,
  opts: {
    filter: PeriodAssignmentAdminFilter
    q?: string
    view?: 'list' | 'tree'
    page?: number
  },
): string {
  const p = new URLSearchParams()
  if (opts.filter !== 'all') p.set('filter', opts.filter)
  const qq = opts.q?.trim()
  if (qq) p.set('q', qq.slice(0, 200))
  if (opts.view === 'tree') p.set('view', 'tree')
  if (opts.page !== undefined && opts.page > 1) p.set('page', String(opts.page))
  const s = p.toString()
  return s ? `/admin/management/${periodId}?${s}` : `/admin/management/${periodId}`
}

export function adminPeriodAssignmentsListPreservedQuery(opts: {
  filter: PeriodAssignmentAdminFilter
  q: string
  view: 'list' | 'tree'
}): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  if (opts.filter !== 'all') out.filter = opts.filter
  const term = opts.q.trim()
  if (term) out.q = term
  if (opts.view === 'tree') out.view = 'tree'
  return out
}
