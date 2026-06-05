'use client'

import { useRouter } from 'next/navigation'

import { AdminFilterSelect } from '@/components/admin/admin-filter-select'
import { AdminListToolbar } from '@/components/admin/admin-list-toolbar'
import {
  buildAdminMembersListUrl,
  type MembersActivityFilter,
} from '@/lib/admin/admin-members-list-url'

const activityFilters = [
  { value: 'all' as const, label: 'Semua status' },
  { value: 'active' as const, label: 'Aktif' },
  { value: 'inactive' as const, label: 'Nonaktif' },
]

export function MembersAdminToolbar({
  filter,
  searchQuery,
  tabCounts,
}: {
  filter: MembersActivityFilter
  searchQuery: string
  tabCounts: { all: number; active: number; inactive: number }
}) {
  const router = useRouter()

  return (
    <AdminListToolbar
      search={{
        inputId: 'admin-members-search',
        label: 'Cari anggota',
        placeholder: 'Nomor member, nama, WhatsApp, atau email',
        value: searchQuery,
        getUrlForQuery: q =>
          buildAdminMembersListUrl({
            filter,
            q,
          }),
      }}
      filterSlot={
        <AdminFilterSelect
          id='admin-members-filter'
          fieldLabel='Status'
          value={filter}
          options={activityFilters}
          counts={tabCounts}
          placeholder='Pilih status'
          onValueChange={v => {
            if (v !== 'all' && v !== 'active' && v !== 'inactive') return
            router.push(
              buildAdminMembersListUrl({
                filter: v,
                q: searchQuery.trim() || undefined,
              }),
            )
          }}
        />
      }
    />
  )
}
