'use client'

import { useRouter } from 'next/navigation'

import { AdminFilterSelect } from '@/components/admin/admin-filter-select'
import { AdminListToolbar } from '@/components/admin/admin-list-toolbar'
import { buildAdminPeriodAssignmentsListUrl } from '@/lib/admin/admin-period-assignments-list-url'
import type { PeriodAssignmentAdminFilter } from '@/lib/management/query-admin-period-assignments'

const filterOptions = [
  { value: 'all' as const, label: 'Semua' },
  { value: 'linked' as const, label: 'Terhubung ke direktori' },
  { value: 'unlinked' as const, label: 'Belum taut' },
]

export function ManagementPeriodAssignmentsAdminToolbar({
  periodId,
  filter,
  searchQuery,
  view,
  tabCounts,
}: {
  periodId: string
  filter: PeriodAssignmentAdminFilter
  searchQuery: string
  view: 'list' | 'tree'
  tabCounts: { all: number; linked: number; unlinked: number }
}) {
  const router = useRouter()

  return (
    <AdminListToolbar
      search={{
        inputId: 'admin-period-assignments-search',
        label: 'Cari penugasan',
        placeholder: 'Jabatan, nama, atau kode publik',
        value: searchQuery,
        getUrlForQuery: q =>
          buildAdminPeriodAssignmentsListUrl(periodId, {
            filter,
            q,
            view,
          }),
      }}
      filterSlot={
        <AdminFilterSelect
          id='admin-period-assignments-filter'
          fieldLabel='Tautan direktori'
          value={filter}
          options={filterOptions}
          counts={tabCounts}
          placeholder='Pilih tautan'
          onValueChange={v => {
            if (v !== 'all' && v !== 'linked' && v !== 'unlinked') return
            router.push(
              buildAdminPeriodAssignmentsListUrl(periodId, {
                filter: v,
                q: searchQuery.trim() || undefined,
                view,
              }),
            )
          }}
        />
      }
    />
  )
}
