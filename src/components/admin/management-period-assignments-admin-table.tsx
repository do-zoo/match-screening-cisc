'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreVerticalIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { TablePagination } from '@/components/ui/table-pagination'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AdminPeriodAssignmentRowVm } from '@/lib/management/query-admin-period-assignments'

export type ManagementPeriodAssignmentsAdminTableProps = {
  rows: AdminPeriodAssignmentRowVm[]
  pathname: string
  preservedQuery: Record<string, string | undefined>
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
  onEdit: (assignment: AdminPeriodAssignmentRowVm) => void
  onDelete: (assignment: AdminPeriodAssignmentRowVm) => void
}

export function ManagementPeriodAssignmentsAdminTable({
  rows,
  pathname,
  preservedQuery,
  pagination,
  onEdit,
  onDelete,
}: ManagementPeriodAssignmentsAdminTableProps) {
  const columns = useMemo<ColumnDef<AdminPeriodAssignmentRowVm>[]>(
    () => [
      {
        id: 'assignment',
        accessorFn: row => row.boardRole.title,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Penugasan' />,
        cell: ({ row }) => {
          const a = row.original
          return (
            <div className='min-w-40 max-w-[280px]'>
              <button
                type='button'
                onClick={() => onEdit(a)}
                className='text-left font-medium underline-offset-4 hover:underline'
              >
                {a.boardRole.title}
              </button>
              <div className='text-sm text-muted-foreground'>{a.managementMember.fullName}</div>
            </div>
          )
        },
      },
      {
        id: 'publicCode',
        accessorFn: row => row.managementMember.publicCode,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Kode publik' />,
        cell: ({ row }) => (
          <span className='font-mono text-sm text-muted-foreground'>{row.original.managementMember.publicCode}</span>
        ),
      },
      {
        id: 'directory',
        header: 'Direktori',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.managementMember.masterMemberId ? (
            <Badge variant='outline' className='border-green-600/40 font-normal text-green-800 dark:text-green-400'>
              Terhubung
            </Badge>
          ) : (
            <Badge variant='secondary' className='font-normal'>
              Belum taut
            </Badge>
          ),
      },
      {
        id: 'actions',
        enableSorting: false,
        header: () => (
          <div className='text-right'>
            <span className='sr-only'>Aksi</span>
          </div>
        ),
        cell: ({ row }) => {
          const a = row.original
          return (
            <div className='flex items-center justify-end gap-1'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='hidden sm:inline-flex'
                onClick={() => onEdit(a)}
              >
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Menu aksi ${a.managementMember.fullName}`}
                  render={<Button type='button' variant='ghost' size='icon-sm' />}
                >
                  <MoreVerticalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem onClick={() => onEdit(a)} className='sm:hidden'>
                    Ubah penugasan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className='sm:hidden' />
                  <DropdownMenuItem variant='destructive' onClick={() => onDelete(a)}>
                    Hapus penugasan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [onDelete, onEdit],
  )

  if (pagination.totalItems === 0) {
    return (
      <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
        Tidak ada penugasan yang cocok dengan filter.
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <DataTable frame='embedded' columns={columns} data={rows} enableSorting={false} />
      <TablePagination
        pathname={pathname}
        preservedQuery={preservedQuery}
        currentPage={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
      />
    </div>
  )
}
