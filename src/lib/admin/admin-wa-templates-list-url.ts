import type { WaTemplateCategory } from '@/lib/wa-templates/wa-template-catalog'
import { parseEventsIndexSearchQuery, parseEventsIndexViewParam, type EventsIndexViewMode } from '@/lib/admin/events-index-view'

export type WaTemplatesIndexTab = 'all' | WaTemplateCategory

export function parseWaTemplatesIndexTab(raw: string | string[] | undefined): WaTemplatesIndexTab {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'pendaftaran' || v === 'verifikasi' || v === 'operasi') return v
  return 'all'
}

export function parseAdminWaTemplatesListParams(sp: Record<string, string | string[] | undefined>): {
  tab: WaTemplatesIndexTab
  q: string
  view: EventsIndexViewMode
} {
  return {
    tab: parseWaTemplatesIndexTab(sp.tab),
    q: parseEventsIndexSearchQuery(sp.q),
    view: parseEventsIndexViewParam(sp.view),
  }
}

/** URL indeks template WA (`?tab=`, `?view=tabel`, `?q=`). */
export function buildAdminWaTemplatesListUrl(opts: {
  tab: WaTemplatesIndexTab
  view: EventsIndexViewMode
  q?: string
}): string {
  const p = new URLSearchParams()
  p.set('tab', opts.tab)
  if (opts.view === 'table') p.set('view', 'tabel')
  const qq = opts.q?.trim()
  if (qq) p.set('q', qq)
  const s = p.toString()
  return s ? `/admin/settings/templates/whatsapp?${s}` : '/admin/settings/templates/whatsapp'
}
