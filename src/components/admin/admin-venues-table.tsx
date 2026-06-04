'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { TablePagination } from '@/components/ui/table-pagination'
import { cn } from '@/lib/utils'

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
        header: ({ column }) => <DataTableColumnHeader column={column} title='Venue' />,
        cell: ({ row }) => (
          <div className='max-w-[240px]'>
            <Link
              href={`/admin/venues/${row.original.id}/edit`}
              className='line-clamp-2 font-medium underline-offset-4 hover:underline'
            >
              {row.original.name}
            </Link>
            <p className='text-muted-foreground line-clamp-2 text-xs whitespace-pre-wrap'>{row.original.address}</p>
          </div>
        ),
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'} className={row.original.isActive ? undefined : 'font-normal'}>
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
        cell: ({ row }) => <div className='text-right tabular-nums text-sm'>{fmtNum.format(row.original.menuItemCount)}</div>,
      },
      {
        accessorKey: 'eventCount',
        header: ({ column }) => (
          <div className='text-right'>
            <DataTableColumnHeader column={column} title='Acara' />
          </div>
        ),
        cell: ({ row }) => <div className='text-right tabular-nums text-sm'>{fmtNum.format(row.original.eventCount)}</div>,
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
          <div className='flex items-center justify-end gap-1'>
            <Link
              href={`/admin/venues/${row.original.id}/menu`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Menu
            </Link>
            <Link
              href={`/admin/venues/${row.original.id}/edit`}
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}
            >
              Edit
            </Link>
          </div>
        ),
      },
    ],
    [],
  )

  if (pagination.totalItems === 0) {
    return (
      <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
        Tidak ada venue untuk filter ini.
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <DataTable
        frame='embedded'
        columns={columns}
        data={venues}
        enableSorting={false}
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
