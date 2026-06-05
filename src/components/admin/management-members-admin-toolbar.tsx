'use client'

import { useRouter } from 'next/navigation'

import { AdminFilterSelect } from '@/components/admin/admin-filter-select'
import { AdminListToolbar } from '@/components/admin/admin-list-toolbar'
import { buildAdminManagementMembersListUrl } from '@/lib/admin/admin-management-members-list-url'
import type { ManagementMemberAdminFilter } from '@/lib/management/query-admin-management-members'

const linkFilters = [
  { value: 'all' as const, label: 'Semua' },
  { value: 'linked' as const, label: 'Terhubung ke direktori' },
  { value: 'unlinked' as const, label: 'Belum taut' },
]

export function ManagementMembersAdminToolbar({
  filter,
  searchQuery,
  tabCounts,
}: {
  filter: ManagementMemberAdminFilter
  searchQuery: string
  tabCounts: { all: number; linked: number; unlinked: number }
}) {
  const router = useRouter()

  return (
    <AdminListToolbar
      search={{
        inputId: 'admin-management-members-search',
        label: 'Cari pengurus',
        placeholder: 'Nama, kode publik, WhatsApp, atau nomor member',
        value: searchQuery,
        getUrlForQuery: q =>
          buildAdminManagementMembersListUrl({
            filter,
            q,
          }),
      }}
      filterSlot={
        <AdminFilterSelect
          id='admin-management-members-filter'
          fieldLabel='Tautan direktori'
          value={filter}
          options={linkFilters}
          counts={tabCounts}
          placeholder='Pilih tautan'
          onValueChange={v => {
            if (v !== 'all' && v !== 'linked' && v !== 'unlinked') return
            router.push(
              buildAdminManagementMembersListUrl({
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
