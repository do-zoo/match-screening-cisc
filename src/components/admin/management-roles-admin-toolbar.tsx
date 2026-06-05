'use client'

import { useRouter } from 'next/navigation'

import { AdminFilterSelect } from '@/components/admin/admin-filter-select'
import { AdminListToolbar } from '@/components/admin/admin-list-toolbar'
import { buildAdminManagementRolesListUrl } from '@/lib/admin/admin-management-roles-list-url'
import type { BoardRoleAdminFilter } from '@/lib/management/query-admin-board-roles'

const filterOptions = [
  { value: 'all' as const, label: 'Semua status' },
  { value: 'active' as const, label: 'Aktif' },
  { value: 'inactive' as const, label: 'Nonaktif' },
]

export function ManagementRolesAdminToolbar({
  filter,
  searchQuery,
  tabCounts,
}: {
  filter: BoardRoleAdminFilter
  searchQuery: string
  tabCounts: { all: number; active: number; inactive: number }
}) {
  const router = useRouter()

  return (
    <AdminListToolbar
      search={{
        inputId: 'admin-management-roles-search',
        label: 'Cari jabatan',
        placeholder: 'Nama jabatan',
        value: searchQuery,
        getUrlForQuery: q =>
          buildAdminManagementRolesListUrl({
            filter,
            q,
          }),
      }}
      filterSlot={
        <AdminFilterSelect
          id='admin-management-roles-filter'
          fieldLabel='Status'
          value={filter}
          options={filterOptions}
          counts={tabCounts}
          placeholder='Pilih status'
          onValueChange={v => {
            if (v !== 'all' && v !== 'active' && v !== 'inactive') return
            router.push(
              buildAdminManagementRolesListUrl({
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
