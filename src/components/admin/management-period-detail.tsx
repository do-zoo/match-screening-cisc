'use client'

import { LayoutListIcon, NetworkIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ManagementAssignmentFormDialog } from '@/components/admin/management-assignment-form-dialog'
import { ManagementPeriodAssignmentsAdminTable } from '@/components/admin/management-period-assignments-admin-table'
import { ManagementPeriodAssignmentsAdminToolbar } from '@/components/admin/management-period-assignments-admin-toolbar'
import {
  adminPeriodAssignmentsListPreservedQuery,
  buildAdminPeriodAssignmentsListUrl,
} from '@/lib/admin/admin-period-assignments-list-url'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import type { PeriodTreeRow } from '@/lib/management/query-admin-period-tree'
import type {
  AdminPeriodAssignmentRowVm,
  PeriodAssignmentAdminFilter,
} from '@/lib/management/query-admin-period-assignments'
import { cn } from '@/lib/utils'

type MemberOption = { id: string; fullName: string; publicCode: string }
type RoleOption = { id: string; title: string }

type Props = {
  period: { id: string; label: string; startsAt: Date; endsAt: Date }
  assignments: AdminPeriodAssignmentRowVm[]
  assignmentsEmpty: boolean
  availableMembers: MemberOption[]
  availableRoles: RoleOption[]
  isActive: boolean
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
  filter: PeriodAssignmentAdminFilter
  searchQuery: string
  tabCounts: { all: number; linked: number; unlinked: number }
  view: 'list' | 'tree'
  treeRows: PeriodTreeRow[]
}

type EditDialogState = {
  assignment: AdminPeriodAssignmentRowVm
  mode: 'edit' | 'delete'
} | null

export function ManagementPeriodDetail({
  period,
  assignments,
  assignmentsEmpty,
  availableMembers,
  availableRoles,
  isActive,
  pagination,
  filter,
  searchQuery,
  tabCounts,
  view,
  treeRows,
}: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editDialog, setEditDialog] = useState<EditDialogState>(null)
  const [treeAddRoleId, setTreeAddRoleId] = useState<string | undefined>(undefined)

  const pathname = `/admin/management/${period.id}`
  const paginationPreserved = adminPeriodAssignmentsListPreservedQuery({ filter, q: searchQuery, view })

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 pb-10 pt-6'>
      <div className='text-sm text-muted-foreground'>
        <Link href='/admin/management' className='hover:text-foreground'>
          ← Kepengurusan
        </Link>
      </div>

      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <div className='flex items-center gap-2'>
            <h1 className='text-2xl font-semibold tracking-tight'>{period.label}</h1>
            {isActive ? (
              <Badge className='bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>Aktif</Badge>
            ) : null}
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            {period.startsAt.toISOString().slice(0, 10)} → {period.endsAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className='flex flex-wrap items-center justify-end gap-2'>
          <div className='flex items-center gap-2'>
            <Link
              href={buildAdminPeriodAssignmentsListUrl(period.id, {
                filter,
                q: searchQuery.trim() || undefined,
                view: 'list',
              })}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), view === 'list' && 'bg-muted')}
            >
              <LayoutListIcon data-icon='inline-start' />
              Daftar
            </Link>
            <Link
              href={buildAdminPeriodAssignmentsListUrl(period.id, {
                filter,
                q: searchQuery.trim() || undefined,
                view: 'tree',
              })}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), view === 'tree' && 'bg-muted')}
            >
              <NetworkIcon data-icon='inline-start' />
              Struktur
            </Link>
          </div>
          <a
            href={`/admin/management/${period.id}/export-csv`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            download
          >
            Export CSV
          </a>
          <a
            href={`/admin/management/${period.id}/export-pdf`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            download
          >
            Export PDF
          </a>
          <Button size='sm' onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon='inline-start' />
            Tambah Penugasan
          </Button>
        </div>
      </div>

      {view === 'list' && (
        <>
          {assignmentsEmpty ? (
            <p className='rounded-lg border border-dashed px-4 md:px-6 py-6 text-sm text-muted-foreground'>
              Belum ada penugasan. Klik &quot;Tambah Penugasan&quot; untuk mengisi roster periode ini.
            </p>
          ) : (
            <div className='flex flex-col gap-4'>
              <ManagementPeriodAssignmentsAdminToolbar
                periodId={period.id}
                filter={filter}
                searchQuery={searchQuery}
                view={view}
                tabCounts={tabCounts}
              />
              <ManagementPeriodAssignmentsAdminTable
                rows={assignments}
                pathname={pathname}
                preservedQuery={paginationPreserved}
                pagination={pagination}
                onEdit={assignment => setEditDialog({ assignment, mode: 'edit' })}
                onDelete={assignment => setEditDialog({ assignment, mode: 'delete' })}
              />
            </div>
          )}
        </>
      )}

      {view === 'tree' && (
        <div className='rounded-lg border'>
          {treeRows.length === 0 ? (
            <p className='px-4 md:px-6 py-6 text-sm text-muted-foreground'>
              Belum ada jabatan. Tambahkan jabatan di halaman{' '}
              <Link href='/admin/management/roles' className='underline'>
                Jabatan
              </Link>{' '}
              terlebih dahulu.
            </p>
          ) : (
            <table className='w-full border-collapse text-sm'>
              <thead>
                <tr className='bg-muted/40'>
                  <th className='px-4 md:px-6 py-2 text-left font-medium text-muted-foreground'>Jabatan</th>
                  <th className='px-4 md:px-6 py-2 text-left font-medium text-muted-foreground'>Pemegang</th>
                  <th className='px-4 md:px-6 py-2' />
                </tr>
              </thead>
              <tbody>
                {treeRows.map(row => (
                  <tr key={row.roleId} className='border-t hover:bg-muted/20'>
                    <td className='px-4 md:px-6 py-2.5' style={{ paddingLeft: 16 + row.depth * 20 }}>
                      {row.depth > 0 && <span className='mr-1 text-muted-foreground'>{'└─'}</span>}
                      <span className={cn('font-medium', row.assignees.length === 0 && 'text-muted-foreground')}>
                        {row.roleTitle}
                      </span>
                      {!row.roleIsUnique && (
                        <Badge className='ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs'>
                          Banyak
                        </Badge>
                      )}
                    </td>
                    <td className='px-4 md:px-6 py-2.5'>
                      {row.assignees.length === 0 ? (
                        <span className='text-muted-foreground italic'>Belum diisi</span>
                      ) : (
                        <span>
                          {row.assignees.map((a, i) => (
                            <span key={a.assignmentId}>
                              {a.fullName}
                              {a.masterMemberId && (
                                <span className='ml-1 text-xs text-green-600 dark:text-green-400'>· direktori</span>
                              )}
                              {i < row.assignees.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className='px-4 md:px-6 py-2.5 text-right'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => {
                          setTreeAddRoleId(row.roleId)
                          setCreateOpen(true)
                        }}
                      >
                        + Tugaskan
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ManagementAssignmentFormDialog
        mode='create'
        boardPeriodId={period.id}
        availableMembers={availableMembers}
        availableRoles={availableRoles}
        defaultRoleId={treeAddRoleId}
        open={createOpen}
        onOpenChange={open => {
          setCreateOpen(open)
          if (!open) setTreeAddRoleId(undefined)
        }}
        onSaved={router.refresh}
      />
      {editDialog ? (
        <ManagementAssignmentFormDialog
          mode='edit'
          boardPeriodId={period.id}
          assignment={editDialog.assignment}
          availableRoles={availableRoles}
          open
          onOpenChange={open => {
            if (!open) setEditDialog(null)
          }}
          onSaved={router.refresh}
          defaultShowDeleteConfirm={editDialog.mode === 'delete'}
        />
      ) : null}
    </main>
  )
}
