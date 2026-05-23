'use client'

import type { AttendanceStatus, RegistrationStatus } from '@prisma/client'
import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'

import { RegistrationStatusBadge } from '@/components/admin/registration-status-badge'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { TablePagination } from '@/components/ui/table-pagination'
import { eventRegistrationDetailPath } from '@/lib/admin/event-registrants-paths'

type EventRegistrantsRow = {
  id: string
  createdAt: string
  contactName: string
  contactWhatsapp: string
  claimedMemberNumber: string | null
  computedTotalAtSubmit: number
  status: RegistrationStatus
  ticketQty: number
  ticketCategoryName: string
  attendanceStatus: AttendanceStatus
}

function attendanceLabel(s: AttendanceStatus): string {
  if (s === 'attended') return 'Hadir'
  if (s === 'no_show') return 'Tidak hadir'
  return 'Belum dicatat'
}

export type EventRegistrantsTableProps = {
  eventId: string
  listPath: string
  preservedQuery: Record<string, string | undefined>
  registrations: EventRegistrantsRow[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function EventRegistrantsTable({
  eventId,
  listPath,
  preservedQuery,
  registrations,
  pagination,
}: EventRegistrantsTableProps) {
  const columns = useMemo<ColumnDef<EventRegistrantsRow>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Dikirim' />,
        cell: ({ row }) => (
          <span className='text-muted-foreground'>{dateFormatter.format(new Date(row.original.createdAt))}</span>
        ),
      },
      {
        id: 'contact',
        accessorFn: row => row.contactName,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Kontak' />,
        cell: ({ row }) => {
          const r = row.original
          return (
            <div>
              <Link
                href={eventRegistrationDetailPath(eventId, r.id)}
                className='font-medium underline-offset-4 hover:underline'
              >
                {r.contactName}
              </Link>
              <div className='font-mono text-xs text-muted-foreground'>{r.contactWhatsapp}</div>
            </div>
          )
        },
      },
      {
        id: 'ticketSummary',
        header: 'Tiket',
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className='text-sm'>
              <div className='font-medium'>{r.ticketCategoryName}</div>
              <div className='text-muted-foreground'>{r.ticketQty} tiket</div>
            </div>
          )
        },
      },
      {
        id: 'attendance',
        header: 'Kehadiran',
        enableSorting: false,
        cell: ({ row }) => (
          <span className='text-sm text-muted-foreground'>{attendanceLabel(row.original.attendanceStatus)}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status pendaftaran' />,
        cell: ({ row }) => <RegistrationStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'computedTotalAtSubmit',
        header: ({ column }) => (
          <div className='text-right'>
            <DataTableColumnHeader column={column} title='Total bayar' />
          </div>
        ),
        cell: ({ row }) => (
          <div className='text-right font-mono'>{idrFormatter.format(row.original.computedTotalAtSubmit)}</div>
        ),
      },
    ],
    [eventId],
  )

  return (
    <div>
      {pagination.totalItems === 0 ? (
        <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
          Belum ada pendaftaran untuk acara ini.
        </div>
      ) : (
        <div className='overflow-hidden rounded-lg border'>
          <DataTable columns={columns} data={registrations} enableSorting={false} />
          <TablePagination
            pathname={listPath}
            preservedQuery={preservedQuery}
            currentPage={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
          />
        </div>
      )}
    </div>
  )
}
