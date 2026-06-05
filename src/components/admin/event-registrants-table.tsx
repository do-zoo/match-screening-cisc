'use client'

import type { AttendanceStatus, RegistrationStatus } from '@prisma/client'
import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'

import { RegistrationStatusBadge } from '@/components/admin/registration-status-badge'
import { buttonVariants } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { TablePagination } from '@/components/ui/table-pagination'
import { eventRegistrationDetailPath } from '@/lib/admin/event-registrants-paths'
import { normalizeIdPhone } from '@/lib/wa-templates/encode'

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

function waMeHref(whatsapp: string): string {
  return `https://wa.me/${normalizeIdPhone(whatsapp)}`
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
        id: 'contact',
        accessorFn: row => row.contactName,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Kontak' />,
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className='min-w-40 max-w-[240px]'>
              <Link
                href={eventRegistrationDetailPath(eventId, r.id)}
                className='font-medium underline-offset-4 hover:underline'
              >
                {r.contactName}
              </Link>
              <a
                href={waMeHref(r.contactWhatsapp)}
                target='_blank'
                rel='noopener noreferrer'
                className='font-mono text-xs text-muted-foreground underline-offset-4 hover:underline'
              >
                {r.contactWhatsapp}
              </a>
              {r.claimedMemberNumber ? (
                <div className='font-mono text-xs text-muted-foreground'>{r.claimedMemberNumber}</div>
              ) : null}
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
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        cell: ({ row }) => <RegistrationStatusBadge status={row.original.status} />,
      },
      {
        id: 'attendance',
        header: 'Kehadiran',
        enableSorting: false,
        cell: ({ row }) => (
          <span className='hidden text-sm text-muted-foreground lg:inline'>{attendanceLabel(row.original.attendanceStatus)}</span>
        ),
      },
      {
        accessorKey: 'computedTotalAtSubmit',
        header: ({ column }) => (
          <div className='text-right'>
            <DataTableColumnHeader column={column} title='Total' />
          </div>
        ),
        cell: ({ row }) => (
          <div className='text-right font-mono text-sm tabular-nums'>
            {idrFormatter.format(row.original.computedTotalAtSubmit)}
          </div>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <span className='hidden lg:inline'>
            <DataTableColumnHeader column={column} title='Dikirim' />
          </span>
        ),
        cell: ({ row }) => (
          <span className='hidden text-muted-foreground text-sm whitespace-nowrap lg:inline'>
            {dateFormatter.format(new Date(row.original.createdAt))}
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
        cell: ({ row }) => (
          <div className='text-right'>
            <Link
              href={eventRegistrationDetailPath(eventId, row.original.id)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Detail
            </Link>
          </div>
        ),
      },
    ],
    [eventId],
  )

  if (pagination.totalItems === 0) {
    return (
      <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
        Belum ada pendaftaran untuk acara ini.
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <DataTable frame='embedded' columns={columns} data={registrations} enableSorting={false} />
      <TablePagination
        pathname={listPath}
        preservedQuery={preservedQuery}
        currentPage={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
      />
    </div>
  )
}
