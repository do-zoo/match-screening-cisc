'use client'

import { useRouter } from 'next/navigation'

import { AdminFilterSelect } from '@/components/admin/admin-filter-select'
import { AdminListToolbar } from '@/components/admin/admin-list-toolbar'
import type { EventsIndexViewMode } from '@/lib/admin/events-index-view'
import { buildAdminEventsIndexUrl } from '@/lib/admin/events-index-view'
import type { EventsIndexStatusTab } from '@/lib/admin/events-index-view-model'

const statusOptions = [
  { value: 'all' as const, label: 'Semua status' },
  { value: 'active' as const, label: 'Aktif' },
  { value: 'draft' as const, label: 'Draf' },
  { value: 'finished' as const, label: 'Selesai' },
]

export function AdminEventsIndexToolbar({
  tab,
  viewMode,
  isOps,
  searchQuery,
}: {
  tab: EventsIndexStatusTab
  viewMode: EventsIndexViewMode
  isOps: boolean
  searchQuery: string
}) {
  const router = useRouter()
  const qTrim = searchQuery.trim() || undefined

  return (
    <AdminListToolbar
      search={{
        inputId: 'admin-events-search',
        label: 'Cari acara',
        placeholder: 'Judul, slug, atau venue…',
        value: searchQuery,
        getUrlForQuery: q =>
          buildAdminEventsIndexUrl({
            tab,
            view: viewMode,
            q,
          }),
      }}
      filterSlot={
        <AdminFilterSelect
          id='admin-events-status'
          fieldLabel='Status acara'
          value={tab}
          options={statusOptions}
          placeholder='Pilih status'
          onValueChange={v => {
            router.push(
              buildAdminEventsIndexUrl({
                tab: v as EventsIndexStatusTab,
                view: viewMode,
                q: qTrim,
              }),
            )
          }}
        />
      }
      viewToggle={
        isOps
          ? {
              mode: viewMode === 'table' ? 'table' : 'cards',
              tableHref: buildAdminEventsIndexUrl({ tab, view: 'table', q: qTrim }),
              cardsHref: buildAdminEventsIndexUrl({ tab, view: 'cards', q: qTrim }),
            }
          : undefined
      }
    />
  )
}
