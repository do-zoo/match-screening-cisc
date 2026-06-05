'use client'

import { useRouter } from 'next/navigation'

import { AdminFilterSelect } from '@/components/admin/admin-filter-select'
import { AdminListToolbar } from '@/components/admin/admin-list-toolbar'
import {
  buildAdminWaTemplatesListUrl,
  type WaTemplatesIndexTab,
} from '@/lib/admin/admin-wa-templates-list-url'
import type { EventsIndexViewMode } from '@/lib/admin/events-index-view'

const tabOptions = [
  { value: 'all' as const, label: 'Semua kategori' },
  { value: 'pendaftaran' as const, label: 'Pendaftaran' },
  { value: 'verifikasi' as const, label: 'Verifikasi' },
  { value: 'operasi' as const, label: 'Operasi' },
]

export function WaTemplatesIndexToolbar({
  tab,
  viewMode,
  searchQuery,
}: {
  tab: WaTemplatesIndexTab
  viewMode: EventsIndexViewMode
  searchQuery: string
}) {
  const router = useRouter()
  const qTrim = searchQuery.trim() || undefined

  return (
    <AdminListToolbar
      search={{
        inputId: 'admin-wa-templates-search',
        label: 'Cari template',
        placeholder: 'Nama atau cuplikan isi…',
        value: searchQuery,
        getUrlForQuery: q =>
          buildAdminWaTemplatesListUrl({
            tab,
            view: viewMode,
            q,
          }),
      }}
      filterSlot={
        <AdminFilterSelect
          id='admin-wa-templates-tab'
          fieldLabel='Kategori'
          value={tab}
          options={tabOptions}
          placeholder='Pilih kategori'
          onValueChange={v => {
            router.push(
              buildAdminWaTemplatesListUrl({
                tab: v as WaTemplatesIndexTab,
                view: viewMode,
                q: qTrim,
              }),
            )
          }}
        />
      }
      viewToggle={{
        mode: viewMode === 'table' ? 'table' : 'cards',
        tableHref: buildAdminWaTemplatesListUrl({ tab, view: 'table', q: qTrim }),
        cardsHref: buildAdminWaTemplatesListUrl({ tab, view: 'cards', q: qTrim }),
      }}
    />
  )
}
