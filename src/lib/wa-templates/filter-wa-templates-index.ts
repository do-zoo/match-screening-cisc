import type { WaTemplateKey } from '@prisma/client'

import type { WaTemplatesIndexTab } from '@/lib/admin/admin-wa-templates-list-url'
import {
  getWaTemplateEntry,
  WA_TEMPLATE_KEYS_ORDERED,
  type WaTemplateCategory,
} from '@/lib/wa-templates/wa-template-catalog'

export type WaTemplateIndexRow = {
  key: WaTemplateKey
  label: string
  description: string
  category: WaTemplateCategory
  bodySnippet: string
  isCustomized: boolean
  updatedAtIso: string | null
}

const CATEGORY_LABEL: Record<WaTemplateCategory, string> = {
  pendaftaran: 'Pendaftaran',
  verifikasi: 'Verifikasi',
  operasi: 'Operasi',
}

export function waTemplateCategoryLabel(category: WaTemplateCategory): string {
  return CATEGORY_LABEL[category]
}

export function buildWaTemplateIndexRows(
  dbRows: { key: WaTemplateKey; body: string; updatedAt: Date }[],
  customizedKeys: Set<WaTemplateKey>,
): WaTemplateIndexRow[] {
  const byKey = new Map(dbRows.map(r => [r.key, r]))

  return WA_TEMPLATE_KEYS_ORDERED.map(key => {
    const catalog = getWaTemplateEntry(key)
    const db = byKey.get(key)
    const effectiveBody = db?.body ?? catalog.defaultBody
    return {
      key,
      label: catalog.labelId,
      description: catalog.descriptionId,
      category: catalog.category,
      bodySnippet: effectiveBody,
      isCustomized: customizedKeys.has(key),
      updatedAtIso: db?.updatedAt.toISOString() ?? null,
    }
  })
}

export function filterWaTemplateIndexRows(
  rows: WaTemplateIndexRow[],
  tab: WaTemplatesIndexTab,
  q: string,
): WaTemplateIndexRow[] {
  const query = q.trim().toLowerCase()
  return rows.filter(row => {
    if (tab !== 'all' && row.category !== tab) return false
    if (!query) return true
    const hay = [row.label, row.description, row.key, row.bodySnippet].join(' ').toLowerCase()
    return hay.includes(query)
  })
}
