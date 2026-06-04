'use client'

import type * as React from 'react'
import type { Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useDataTableSortingEnabled } from '@/components/ui/data-table-sorting-context'
import { cn } from '@/lib/utils'

export const dataTableColumnLabelClass =
  'text-xs font-medium tracking-wide text-muted-foreground uppercase'

type DataTableColumnHeaderProps<TData, TValue> = React.HTMLAttributes<HTMLDivElement> & {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  className,
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const sortingEnabled = useDataTableSortingEnabled()

  if (!sortingEnabled || !column.getCanSort()) {
    return <div className={cn(dataTableColumnLabelClass, className)}>{title}</div>
  }

  return (
    <div className={cn('flex items-center', className)}>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className={cn(
          dataTableColumnLabelClass,
          '-ms-2 h-8 gap-1 px-2 hover:bg-transparent hover:text-foreground',
        )}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        <span>{title}</span>
        {column.getIsSorted() === 'desc' ? (
          <ArrowDown className='size-3.5 shrink-0 opacity-80' />
        ) : column.getIsSorted() === 'asc' ? (
          <ArrowUp className='size-3.5 shrink-0 opacity-80' />
        ) : (
          <ChevronsUpDown className='size-3.5 shrink-0 opacity-50' />
        )}
      </Button>
    </div>
  )
}
