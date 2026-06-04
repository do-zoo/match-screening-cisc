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
import type { AdminBoardRoleRowVm } from '@/lib/management/query-admin-board-roles'
import { cn } from '@/lib/utils'

type TreeFlatEntry = { node: AdminBoardRoleRowVm; depth: number }

export type ManagementRolesAdminTableProps = {
  rows: AdminBoardRoleRowVm[]
  isTreeMode: boolean
  treeFlat: TreeFlatEntry[]
  pathname: string
  preservedQuery: Record<string, string | undefined>
  pagination?: {
    page: number
    pageSize: number
    totalItems: number
  }
  onEdit: (role: AdminBoardRoleRowVm) => void
  onDeactivate: (role: AdminBoardRoleRowVm) => void
}

export function ManagementRolesAdminTable({
  rows,
  isTreeMode,
  treeFlat,
  pathname,
  preservedQuery,
  pagination,
  onEdit,
  onDeactivate,
}: ManagementRolesAdminTableProps) {
  const columns = useMemo<ColumnDef<AdminBoardRoleRowVm>[]>(
    () => [
      {
        accessorKey: 'title',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Jabatan' />,
        cell: ({ row }) => {
          if (!isTreeMode) {
            return (
              <button
                type='button'
                onClick={() => onEdit(row.original)}
                className='text-left font-medium underline-offset-4 hover:underline'
              >
                {row.original.title}
              </button>
            )
          }
          const entry = treeFlat.find(f => f.node.id === row.original.id)
          const depth = entry?.depth ?? 0
          return (
            <span className='font-medium' style={{ paddingLeft: depth * 20 }}>
              {depth > 0 ? <span className='mr-1 text-muted-foreground'>{'└─'.repeat(depth)}</span> : null}
              {row.original.title}
            </span>
          )
        },
      },
      {
        id: 'isUnique',
        header: 'Kapasitas',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isUnique ? (
            <Badge variant='outline' className='font-normal'>
              1 orang
            </Badge>
          ) : (
            <Badge variant='secondary' className='font-normal'>
              Banyak
            </Badge>
          ),
      },
      {
        accessorKey: 'sortOrder',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Urutan' />,
        cell: ({ row }) => <span className='text-muted-foreground tabular-nums'>{row.original.sortOrder}</span>,
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'} className={row.original.isActive ? undefined : 'font-normal'}>
            {row.original.isActive ? 'Aktif' : 'Nonaktif'}
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
          const r = row.original
          return (
            <div className='flex items-center justify-end gap-1'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='hidden sm:inline-flex'
                onClick={() => onEdit(r)}
              >
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Menu aksi ${r.title}`}
                  render={<Button type='button' variant='ghost' size='icon-sm' />}
                >
                  <MoreVerticalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem onClick={() => onEdit(r)} className='sm:hidden'>
                    Edit jabatan
                  </DropdownMenuItem>
                  {r.isActive ? (
                    <>
                      <DropdownMenuSeparator className={isTreeMode ? undefined : 'sm:hidden'} />
                      <DropdownMenuItem variant='destructive' onClick={() => onDeactivate(r)}>
                        Nonaktifkan
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [isTreeMode, onDeactivate, onEdit, treeFlat],
  )

  if (rows.length === 0) {
    return (
      <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
        Tidak ada jabatan yang cocok dengan filter.
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <DataTable
        frame='embedded'
        columns={columns}
        data={rows}
        enableSorting={false}
        getRowClassName={row => cn(!row.isActive && 'opacity-60 hover:opacity-80')}
      />
      {pagination ? (
        <TablePagination
          pathname={pathname}
          preservedQuery={preservedQuery}
          currentPage={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
        />
      ) : null}
    </div>
  )
}
