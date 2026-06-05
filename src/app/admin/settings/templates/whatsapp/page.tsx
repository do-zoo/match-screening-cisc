import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { WaTemplateKey } from '@prisma/client'

import { WaTemplatesCardsView } from '@/components/admin/wa-templates/wa-templates-cards-view'
import { WaTemplatesIndexHeader } from '@/components/admin/wa-templates/wa-templates-index-header'
import { WaTemplatesIndexToolbar } from '@/components/admin/wa-templates/wa-templates-index-toolbar'
import { WaTemplatesTable } from '@/components/admin/wa-templates/wa-templates-table'
import { parseAdminWaTemplatesListParams } from '@/lib/admin/admin-wa-templates-list-url'
import { prisma } from '@/lib/db/prisma'
import {
  buildWaTemplateIndexRows,
  filterWaTemplateIndexRows,
} from '@/lib/wa-templates/filter-wa-templates-index'

export const metadata: Metadata = { title: 'Template WhatsApp' }

function tabParamMissing(tabParam: string | string[] | undefined): boolean {
  return (
    tabParam === undefined ||
    tabParam === '' ||
    (Array.isArray(tabParam) && (tabParam.length === 0 || tabParam[0] === ''))
  )
}

export default async function WhatsappTemplatesIndexPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}

  if (tabParamMissing(sp.tab)) {
    const p = new URLSearchParams()
    p.set('tab', 'all')
    const { view, q } = parseAdminWaTemplatesListParams(sp)
    if (view === 'table') p.set('view', 'tabel')
    if (q) p.set('q', q)
    redirect(`/admin/settings/templates/whatsapp?${p.toString()}`)
  }

  const { tab, q, view } = parseAdminWaTemplatesListParams(sp)

  const waRows = await prisma.clubWaTemplate.findMany({
    select: { key: true, body: true, updatedAt: true },
  })

  const customizedKeys = new Set(waRows.map(r => r.key as WaTemplateKey))

  const allRows = buildWaTemplateIndexRows(
    waRows.map(r => ({
      key: r.key as WaTemplateKey,
      body: r.body,
      updatedAt: r.updatedAt,
    })),
    customizedKeys,
  )
  const filtered = filterWaTemplateIndexRows(allRows, tab, q)

  return (
    <div className='space-y-6'>
      <WaTemplatesIndexHeader />
      <WaTemplatesIndexToolbar tab={tab} viewMode={view} searchQuery={q} />
      {view === 'table' ? <WaTemplatesTable rows={filtered} /> : <WaTemplatesCardsView rows={filtered} />}
    </div>
  )
}
