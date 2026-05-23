'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { TablePagination } from '@/components/ui/table-pagination'

const fmtNum = new Intl.NumberFormat('id-ID')

export type AdminVenueRow = {
  id: string
  name: string
  address: string
  isActive: boolean
  menuItemCount: number
  eventCount: number
}

type Props = {
  venues: AdminVenueRow[]
  pathname: string
  preservedQuery?: Record<string, string | undefined>
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
}

export function AdminVenuesTable({ venues, pathname, preservedQuery, pagination }: Props) {
  const columns = useMemo<ColumnDef<AdminVenueRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Nama' />,
        cell: ({ row }) => (
          <div className='max-w-[240px]'>
            <Link
              href={`/admin/venues/${row.original.id}/edit`}
              className='text-foreground line-clamp-2 font-medium hover:underline'
            >
              {row.original.name}
            </Link>
          </div>
        ),
      },
      {
        accessorKey: 'address',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Alamat' />,
        cell: ({ row }) => (
          <span className='text-muted-foreground line-clamp-2 max-w-[320px] text-sm whitespace-pre-wrap'>
            {row.original.address}
          </span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Aktif' : 'Tidak aktif'}
          </Badge>
        ),
      },
      {
        accessorKey: 'menuItemCount',
        header: ({ column }) => (
          <div className='text-right'>
            <DataTableColumnHeader column={column} title='Menu' />
          </div>
        ),
        cell: ({ row }) => <div className='text-right tabular-nums'>{fmtNum.format(row.original.menuItemCount)}</div>,
      },
      {
        accessorKey: 'eventCount',
        header: ({ column }) => (
          <div className='text-right'>
            <DataTableColumnHeader column={column} title='Acara' />
          </div>
        ),
        cell: ({ row }) => <div className='text-right tabular-nums'>{fmtNum.format(row.original.eventCount)}</div>,
      },
      {
        id: 'actions',
        enableSorting: false,
        header: () => (
          <div className='text-right'>
            <span className='sr-only'>Aksi</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className='text-right'>
            <Link
              href={`/admin/venues/${row.original.id}/edit`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Kelola
            </Link>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <div className='bg-card flex flex-col gap-0 overflow-hidden rounded-lg border'>
      <DataTable columns={columns} data={venues} enableSorting={false} />
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
