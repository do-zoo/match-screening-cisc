'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import type { EmailTemplateIndexRow } from '@/lib/email-templates/build-email-template-index-rows'

const fmtDay = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function EmailTemplatesTable({ rows }: { rows: EmailTemplateIndexRow[] }) {
  const columns = useMemo<ColumnDef<EmailTemplateIndexRow>[]>(
    () => [
      {
        accessorKey: 'label',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Nama' />,
        cell: ({ row }) => (
          <div className='min-w-40 max-w-[320px]'>
            <div className='font-medium'>{row.original.label}</div>
            <div className='text-muted-foreground line-clamp-1 text-xs'>{row.original.description}</div>
          </div>
        ),
      },
      {
        accessorKey: 'usedWhen',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Dipakai saat' />,
        cell: ({ row }) => (
          <span className='text-muted-foreground max-w-[280px] text-sm leading-snug'>{row.original.usedWhen}</span>
        ),
      },
      {
        id: 'customized',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        cell: ({ row }) => (
          <div className='flex flex-wrap gap-1'>
            {row.original.isSystemTemplate ? (
              <Badge variant='outline' className='text-xs'>
                Sistem
              </Badge>
            ) : null}
            <Badge variant={row.original.isCustomized ? 'default' : 'secondary'}>
              {row.original.isCustomized ? 'Kustom' : 'Bawaan'}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: 'updatedAtIso',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Diperbarui' />,
        cell: ({ row }) => (
          <span className='text-muted-foreground text-sm whitespace-nowrap'>
            {row.original.updatedAtIso ? fmtDay.format(new Date(row.original.updatedAtIso)) : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className='sr-only'>Aksi</span>,
        cell: ({ row }) => (
          <Link
            href={`/admin/settings/templates/email/${row.original.key}/edit`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Edit
          </Link>
        ),
      },
    ],
    [],
  )

  return <DataTable columns={columns} data={rows} />
}
