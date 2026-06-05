'use client'

import { useRouter } from 'next/navigation'

import { AdminFilterSelect } from '@/components/admin/admin-filter-select'
import { AdminListToolbar } from '@/components/admin/admin-list-toolbar'
import { buildAdminVenuesIndexUrl, type VenuesIndexTab } from '@/lib/admin/admin-venues-index'
import type { EventsIndexViewMode } from '@/lib/admin/events-index-view'

const tabOptions = [
  { value: 'all' as const, label: 'Semua venue' },
  { value: 'active' as const, label: 'Aktif' },
  { value: 'inactive' as const, label: 'Tidak aktif' },
]

export function AdminVenuesIndexToolbar({
  tab,
  viewMode,
  searchQuery,
}: {
  tab: VenuesIndexTab
  viewMode: EventsIndexViewMode
  searchQuery: string
}) {
  const router = useRouter()
  const qTrim = searchQuery.trim() || undefined

  return (
    <AdminListToolbar
      search={{
        inputId: 'admin-venues-search',
        label: 'Cari venue',
        placeholder: 'Nama atau alamat…',
        value: searchQuery,
        getUrlForQuery: q =>
          buildAdminVenuesIndexUrl({
            tab,
            view: viewMode,
            q,
          }),
      }}
      filterSlot={
        <AdminFilterSelect
          id='admin-venues-tab'
          fieldLabel='Status venue'
          value={tab}
          options={tabOptions}
          placeholder='Pilih status'
          onValueChange={v => {
            router.push(
              buildAdminVenuesIndexUrl({
                tab: v as VenuesIndexTab,
                view: viewMode,
                q: qTrim,
              }),
            )
          }}
        />
      }
      viewToggle={{
        mode: viewMode === 'table' ? 'table' : 'cards',
        tableHref: buildAdminVenuesIndexUrl({ tab, view: 'table', q: qTrim }),
        cardsHref: buildAdminVenuesIndexUrl({ tab, view: 'cards', q: qTrim }),
      }}
    />
  )
}
