'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { EventStatus } from '@prisma/client'
import type { VariantProps } from 'class-variance-authority'

import { Badge, badgeVariants } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { TablePagination } from '@/components/ui/table-pagination'
import { eventRegistrantsListPath } from '@/lib/admin/event-registrants-paths'

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

const eventStatusBadge: Record<EventStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Aktif', variant: 'default' },
  draft: { label: 'Draf', variant: 'secondary' },
  finished: { label: 'Selesai', variant: 'outline' },
}

export type AdminEventRow = {
  id: string
  slug: string
  title: string
  status: EventStatus
  startAtIso: string
  picFullName: string | null
  registrationCount: number
}

type Props = {
  events: AdminEventRow[]
  pathname: string
  preservedQuery?: Record<string, string | undefined>
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
}

const fmtDay = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const fmtNum = new Intl.NumberFormat('id-ID')

export function AdminEventsTable({ events, pathname, preservedQuery, pagination }: Props) {
  const columns = useMemo<ColumnDef<AdminEventRow>[]>(
    () => [
      {
        id: 'event',
        accessorFn: row => row.title,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Acara' />,
        cell: ({ row }) => {
          const e = row.original
          return (
            <div className='min-w-40 max-w-[280px]'>
              <Link href={`/admin/events/${e.id}/edit`} className='line-clamp-2 font-medium underline-offset-4 hover:underline'>
                {e.title}
              </Link>
              <div className='font-mono text-xs text-muted-foreground'>{e.slug}</div>
            </div>
          )
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        cell: ({ row }) => {
          const meta = eventStatusBadge[row.original.status]
          return <Badge variant={meta.variant}>{meta.label}</Badge>
        },
      },
      {
        accessorKey: 'startAtIso',
        header: ({ column }) => (
          <span className='hidden md:inline'>
            <DataTableColumnHeader column={column} title='Kick-off' />
          </span>
        ),
        cell: ({ row }) => (
          <span className='hidden text-muted-foreground text-sm whitespace-nowrap md:inline'>
            {fmtDay.format(new Date(row.original.startAtIso))}
          </span>
        ),
      },
      {
        accessorKey: 'picFullName',
        header: ({ column }) => <DataTableColumnHeader column={column} title='PIC' />,
        cell: ({ row }) => (
          <span className='max-w-[180px] truncate text-sm'>{row.original.picFullName ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'registrationCount',
        header: ({ column }) => (
          <div className='text-right'>
            <DataTableColumnHeader column={column} title='Peserta' />
          </div>
        ),
        cell: ({ row }) => (
          <div className='text-right tabular-nums text-sm'>{fmtNum.format(row.original.registrationCount)}</div>
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
        cell: ({ row }) => (
          <div className='flex items-center justify-end gap-1'>
            <Link
              href={eventRegistrantsListPath(row.original.id)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Peserta
            </Link>
            <Link
              href={`/admin/events/${row.original.id}/edit`}
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
        Tidak ada acara untuk filter ini.
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <DataTable frame='embedded' columns={columns} data={events} enableSorting={false} />
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
