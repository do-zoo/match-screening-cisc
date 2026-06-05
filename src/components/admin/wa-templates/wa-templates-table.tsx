'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import type { WaTemplateIndexRow } from '@/lib/wa-templates/filter-wa-templates-index'
import { waTemplateCategoryLabel } from '@/lib/wa-templates/filter-wa-templates-index'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

const fmtDay = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function WaTemplatesTable({ rows }: { rows: WaTemplateIndexRow[] }) {
  const columns = useMemo<ColumnDef<WaTemplateIndexRow>[]>(
    () => [
      {
        accessorKey: 'label',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Nama' />,
        cell: ({ row }) => (
          <div className='min-w-40 max-w-[280px]'>
            <div className='font-medium'>{row.original.label}</div>
            <div className='text-muted-foreground line-clamp-1 text-xs'>{row.original.description}</div>
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Kategori' />,
        cell: ({ row }) => <Badge variant='outline'>{waTemplateCategoryLabel(row.original.category)}</Badge>,
      },
      {
        id: 'customized',
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        cell: ({ row }) => (
          <Badge variant={row.original.isCustomized ? 'default' : 'secondary'}>
            {row.original.isCustomized ? 'Kustom' : 'Bawaan'}
          </Badge>
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
            href={`/admin/settings/templates/whatsapp/${row.original.key}/edit`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Edit
          </Link>
        ),
      },
    ],
    [],
  )

  if (rows.length === 0) {
    return (
      <div className='text-muted-foreground bg-card rounded-lg border border-dashed p-8 text-center text-sm'>
        Tidak ada template untuk filter ini.
      </div>
    )
  }

  return <DataTable columns={columns} data={rows} />
}
