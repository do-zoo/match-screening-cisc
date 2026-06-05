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
import type { AdminMasterMemberRowVm } from '@/lib/members/query-admin-master-members'
import { normalizeIdPhone } from '@/lib/wa-templates/encode'
import { cn } from '@/lib/utils'

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

function waMeHref(whatsapp: string): string {
  return `https://wa.me/${normalizeIdPhone(whatsapp)}`
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'default' : 'secondary'} className={active ? undefined : 'font-normal'}>
      {active ? 'Aktif' : 'Nonaktif'}
    </Badge>
  )
}

function PengurusBadge({ isManagement }: { isManagement: boolean }) {
  if (!isManagement) {
    return <span className='text-muted-foreground text-sm'>—</span>
  }
  return <Badge variant='outline'>Pengurus</Badge>
}

export type MembersAdminTableProps = {
  rows: AdminMasterMemberRowVm[]
  pathname: string
  preservedQuery: Record<string, string | undefined>
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
  isOwner: boolean
  onEdit: (member: AdminMasterMemberRowVm) => void
  onDelete: (member: AdminMasterMemberRowVm) => void
}

export function MembersAdminTable({
  rows,
  pathname,
  preservedQuery,
  pagination,
  isOwner,
  onEdit,
  onDelete,
}: MembersAdminTableProps) {
  const columns = useMemo<ColumnDef<AdminMasterMemberRowVm>[]>(
    () => [
      {
        id: 'member',
        accessorFn: row => row.fullName,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Anggota' />,
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
              <div className='font-mono text-xs text-muted-foreground'>{m.memberNumber}</div>
            </div>
          )
        },
      },
      {
        id: 'contact',
        header: 'Kontak',
        enableSorting: false,
        cell: ({ row }) => {
          const { whatsapp, email } = row.original
          if (!whatsapp && !email) {
            return <span className='text-muted-foreground text-sm'>—</span>
          }
          return (
            <div className='flex max-w-[220px] flex-col gap-0.5 text-sm'>
              {whatsapp ? (
                <a
                  href={waMeHref(whatsapp)}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-foreground underline-offset-4 hover:underline'
                >
                  {whatsapp}
                </a>
              ) : null}
              {email ? (
                <a
                  href={`mailto:${encodeURIComponent(email)}`}
                  className='text-muted-foreground truncate underline-offset-4 hover:underline'
                  title={email}
                >
                  {email}
                </a>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        cell: ({ row }) => <StatusBadge active={row.original.isActive} />,
      },
      {
        accessorKey: 'isManagementMember',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Pengurus' />,
        cell: ({ row }) => <PengurusBadge isManagement={row.original.isManagementMember} />,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <span className='hidden lg:inline'>
            <DataTableColumnHeader column={column} title='Dibuat' />
          </span>
        ),
        cell: ({ row }) => (
          <span className='hidden text-muted-foreground text-sm whitespace-nowrap lg:inline'>
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: ({ column }) => (
          <span className='hidden lg:inline'>
            <DataTableColumnHeader column={column} title='Diubah' />
          </span>
        ),
        cell: ({ row }) => (
          <span className='hidden text-muted-foreground text-sm whitespace-nowrap lg:inline'>
            {formatDate(row.original.updatedAt)}
          </span>
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
          const m = row.original
          return (
            <div className='flex items-center justify-end gap-1'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className={isOwner ? 'hidden sm:inline-flex' : 'inline-flex'}
                onClick={() => onEdit(m)}
              >
                Edit
              </Button>
              {isOwner ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Menu aksi ${m.fullName}`}
                    render={<Button type='button' variant='ghost' size='icon-sm' />}
                  >
                    <MoreVerticalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem onClick={() => onEdit(m)} className='sm:hidden'>
                      Edit anggota
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className='sm:hidden' />
                    <DropdownMenuItem variant='destructive' onClick={() => onDelete(m)}>
                      Hapus anggota
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          )
        },
      },
    ],
    [isOwner, onDelete, onEdit],
  )

  if (pagination.totalItems === 0) {
    return (
      <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
        Tidak ada anggota yang cocok dengan filter.
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
        emptyMessage='Tidak ada anggota yang cocok dengan filter.'
        getRowClassName={row => cn(!row.isActive && 'opacity-60 hover:opacity-80')}
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
