import { parseEventsIndexSearchQuery } from '@/lib/admin/events-index-view'
import type { BoardRoleAdminFilter } from '@/lib/management/query-admin-board-roles'
import { parseAdminTablePage } from '@/lib/table/admin-pagination'

export function parseBoardRoleAdminFilter(raw: string | string[] | undefined): BoardRoleAdminFilter {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'active' || v === 'inactive') return v
  return 'all'
}

export function parseAdminManagementRolesListSearchParams(
  sp: Record<string, string | string[] | undefined>,
): {
  filter: BoardRoleAdminFilter
  q: string
  page: number
} {
  return {
    filter: parseBoardRoleAdminFilter(sp.filter),
    q: parseEventsIndexSearchQuery(sp.q),
    page: parseAdminTablePage(sp.page),
  }
}

export function buildAdminManagementRolesListUrl(opts: {
  filter: BoardRoleAdminFilter
  q?: string
  page?: number
}): string {
  const p = new URLSearchParams()
  if (opts.filter !== 'all') p.set('filter', opts.filter)
  const qq = opts.q?.trim()
  if (qq) p.set('q', qq.slice(0, 200))
  if (opts.page !== undefined && opts.page > 1) p.set('page', String(opts.page))
  const s = p.toString()
  return s ? `/admin/management/roles?${s}` : '/admin/management/roles'
}

export function adminManagementRolesListPreservedQuery(opts: {
  filter: BoardRoleAdminFilter
  q: string
}): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  if (opts.filter !== 'all') out.filter = opts.filter
  const term = opts.q.trim()
  if (term) out.q = term
  return out
}
