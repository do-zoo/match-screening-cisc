'use client'

import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTableSortingProvider } from '@/components/ui/data-table-sorting-context'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** `embedded` = tanpa border sendiri (dipakai di dalam shell admin); `standalone` = border sendiri. */
  frame?: 'embedded' | 'standalone'
  emptyMessage?: string
  enableSorting?: boolean
  getRowClassName?: (row: TData) => string | undefined
  enableGlobalFilter?: boolean
  globalFilterPlaceholder?: string
  filterSelectColumn?: string
  filterSelectOptions?: { label: string; value: string }[]
  filterSelectAllLabel?: string
  enablePagination?: boolean
  pageSize?: number
}

export function DataTable<TData, TValue>({
  columns,
  data,
  frame = 'standalone',
  emptyMessage = 'No results.',
  enableSorting = true,
  getRowClassName,
  enableGlobalFilter = false,
  globalFilterPlaceholder = 'Cari...',
  filterSelectColumn,
  filterSelectOptions,
  filterSelectAllLabel = 'Semua',
  enablePagination = false,
  pageSize = 10,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  const needsFiltering = enableGlobalFilter || !!filterSelectColumn

  /* eslint-disable-next-line react-hooks/incompatible-library -- useReactTable is the supported API */
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(needsFiltering ? { getFilteredRowModel: getFilteredRowModel() } : {}),
    ...(enableSorting
      ? { getSortedRowModel: getSortedRowModel(), onSortingChange: setSorting }
      : { manualSorting: true }),
    ...(enablePagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    ...(enablePagination ? { initialState: { pagination: { pageSize } } } : {}),
    state: {
      sorting,
      ...(enableGlobalFilter ? { globalFilter } : {}),
      ...(!!filterSelectColumn ? { columnFilters } : {}),
    },
    ...(enableGlobalFilter ? { onGlobalFilterChange: setGlobalFilter } : {}),
    ...(!!filterSelectColumn ? { onColumnFiltersChange: setColumnFilters } : {}),
  })

  const selectFilterValue =
    (columnFilters.find(f => f.id === filterSelectColumn)?.value as string | undefined) ?? '__all__'

  function handleSelectFilterChange(value: string | null) {
    if (value == null) return
    setColumnFilters(value === '__all__' ? [] : [{ id: filterSelectColumn!, value }])
  }

  const showFiltersBar = enableGlobalFilter || (!!filterSelectColumn && !!filterSelectOptions)

  const filterLabelByValue = React.useMemo(() => {
    if (!filterSelectOptions) return new Map<string, string>()
    return new Map(filterSelectOptions.map(o => [o.value, o.label]))
  }, [filterSelectOptions])

  const tableBlock = (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id} className='hover:bg-transparent'>
            {headerGroup.headers.map(header => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map(row => (
            <TableRow key={row.id} className={cn(getRowClassName?.(row.original))}>
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className='h-24 text-center text-muted-foreground'>
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )

  return (
    <DataTableSortingProvider enabled={enableSorting}>
    <div className='space-y-3'>
      {showFiltersBar && (
        <div className='flex flex-wrap items-center gap-2'>
          {enableGlobalFilter && (
            <Input
              placeholder={globalFilterPlaceholder}
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              className='max-w-xs'
            />
          )}
          {filterSelectColumn && filterSelectOptions && (
            <Select value={selectFilterValue} onValueChange={handleSelectFilterChange}>
              <SelectTrigger className='w-44'>
                <SelectValue placeholder={filterSelectAllLabel}>
                  {v => {
                    if (v == null || v === '' || v === '__all__') return filterSelectAllLabel
                    return filterLabelByValue.get(String(v)) ?? String(v)
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__all__'>{filterSelectAllLabel}</SelectItem>
                {filterSelectOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {frame === 'standalone' ? (
        <div className='overflow-hidden rounded-md border'>{tableBlock}</div>
      ) : (
        tableBlock
      )}

      {enablePagination && (
        <div className='flex flex-col gap-3 border-t bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-xs text-muted-foreground tabular-nums'>
            {table.getFilteredRowModel().rows.length === 0 ? (
              'Tidak ada baris.'
            ) : (
              <>
                Baris{' '}
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length,
                )}{' '}
                · {table.getFilteredRowModel().rows.length} total
              </>
            )}
          </p>
          <div className='flex items-center gap-1'>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className='size-8'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label='Halaman sebelumnya'
            >
              <ChevronLeft className='size-4' />
            </Button>
            <span className='min-w-18 rounded-md border bg-background/60 px-2 py-1 text-center text-xs tabular-nums text-muted-foreground'>
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className='size-8'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label='Halaman berikutnya'
            >
              <ChevronRight className='size-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
    </DataTableSortingProvider>
  )
}
