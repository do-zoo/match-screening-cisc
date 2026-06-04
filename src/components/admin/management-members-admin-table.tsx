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
import type { AdminManagementMemberRowVm } from '@/lib/management/query-admin-management-members'
import { normalizeIdPhone } from '@/lib/wa-templates/encode'
import { cn } from '@/lib/utils'

function waMeHref(whatsapp: string): string {
  return `https://wa.me/${normalizeIdPhone(whatsapp)}`
}

function DirectoryLinkBadge({ memberNumber }: { memberNumber: string }) {
  return (
    <Badge
      variant='outline'
      className='border-green-600/40 font-mono text-green-800 dark:text-green-400'
      title='Terhubung ke direktori anggota'
    >
      {memberNumber}
    </Badge>
  )
}

export type ManagementMembersAdminTableProps = {
  rows: AdminManagementMemberRowVm[]
  pathname: string
  preservedQuery: Record<string, string | undefined>
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
  onEdit: (member: AdminManagementMemberRowVm) => void
  onDelete: (member: AdminManagementMemberRowVm) => void
}

export function ManagementMembersAdminTable({
  rows,
  pathname,
  preservedQuery,
  pagination,
  onEdit,
  onDelete,
}: ManagementMembersAdminTableProps) {
  const columns = useMemo<ColumnDef<AdminManagementMemberRowVm>[]>(
    () => [
      {
        id: 'pengurus',
        accessorFn: row => row.fullName,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Pengurus' />,
        cell: ({ row }) => {
          const m = row.original
          return (
            <div className='min-w-40 max-w-[240px]'>
              <button
                type='button'
                onClick={() => onEdit(m)}
                className='text-left font-medium underline-offset-4 hover:underline'
              >
                {m.fullName}
              </button>
              <div className='font-mono text-xs text-muted-foreground'>{m.publicCode}</div>
            </div>
          )
        },
      },
      {
        id: 'contact',
        header: 'Kontak',
        enableSorting: false,
        cell: ({ row }) => {
          const { whatsapp } = row.original
          if (!whatsapp) {
            return <span className='text-muted-foreground text-sm'>—</span>
          }
          return (
            <a
              href={waMeHref(whatsapp)}
              target='_blank'
              rel='noopener noreferrer'
              className='text-sm underline-offset-4 hover:underline'
            >
              {whatsapp}
            </a>
          )
        },
      },
      {
        id: 'directory',
        accessorFn: row => row.masterMember?.memberNumber ?? '',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Direktori' />,
        cell: ({ row }) => {
          const linked = row.original.masterMember
          if (linked) {
            return <DirectoryLinkBadge memberNumber={linked.memberNumber} />
          }
          return (
            <Badge variant='secondary' className='font-normal'>
              Belum taut
            </Badge>
          )
        },
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
          const m = row.original
          return (
            <div className='flex items-center justify-end gap-1'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='hidden sm:inline-flex'
                onClick={() => onEdit(m)}
              >
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Menu aksi ${m.fullName}`}
                  render={<Button type='button' variant='ghost' size='icon-sm' />}
                >
                  <MoreVerticalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem onClick={() => onEdit(m)} className='sm:hidden'>
                    Edit pengurus
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className='sm:hidden' />
                  <DropdownMenuItem variant='destructive' onClick={() => onDelete(m)}>
                    Hapus pengurus
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
        Tidak ada pengurus yang cocok dengan filter.
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
        emptyMessage='Tidak ada pengurus yang cocok dengan filter.'
        getRowClassName={row => cn(!row.masterMemberId && 'opacity-75 hover:opacity-90')}
      />
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
