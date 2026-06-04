import { parseEventsIndexSearchQuery } from '@/lib/admin/events-index-view'
import { parseAdminTablePage } from '@/lib/table/admin-pagination'

export type MembersActivityFilter = 'all' | 'active' | 'inactive'

export function parseMembersActivityFilter(raw: string | string[] | undefined): MembersActivityFilter {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'active' || v === 'inactive') return v
  return 'all'
}

export function parseAdminMembersListSearchParams(sp: Record<string, string | string[] | undefined>): {
  filter: MembersActivityFilter
  q: string
  page: number
} {
  return {
    filter: parseMembersActivityFilter(sp.filter),
    q: parseEventsIndexSearchQuery(sp.q),
    page: parseAdminTablePage(sp.page),
  }
}

/** URL daftar anggota (`?filter=`, `?q=`, `?page=`). Pencarian/filter baru tidak menyertakan `page` → halaman 1. */
export function buildAdminMembersListUrl(opts: {
  filter: MembersActivityFilter
  q?: string
  page?: number
}): string {
  const p = new URLSearchParams()
  if (opts.filter !== 'all') p.set('filter', opts.filter)
  const qq = opts.q?.trim()
  if (qq) p.set('q', qq.slice(0, 200))
  if (opts.page !== undefined && opts.page > 1) p.set('page', String(opts.page))
  const s = p.toString()
  return s ? `/admin/members?${s}` : '/admin/members'
}

export function adminMembersListPreservedQuery(opts: {
  filter: MembersActivityFilter
  q: string
}): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  if (opts.filter !== 'all') out.filter = opts.filter
  const term = opts.q.trim()
  if (term) out.q = term
  return out
}
