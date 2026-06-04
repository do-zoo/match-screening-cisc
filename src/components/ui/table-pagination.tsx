'use client'

import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TablePaginationProps = {
  pathname: string
  /** Omit `page`; other params are echoed (e.g. q, filter). */
  preservedQuery?: Record<string, string | undefined>
  currentPage: number
  pageSize: number
  totalItems: number
  className?: string
}

function buildHref(pathname: string, preserved: Record<string, string | undefined> | undefined, page: number): string {
  const qs = new URLSearchParams()
  if (preserved) {
    for (const [k, v] of Object.entries(preserved)) {
      if (v !== undefined && v !== '') qs.set(k, v)
    }
  }
  if (page > 1) qs.set('page', String(page))
  const s = qs.toString()
  return s ? `${pathname}?${s}` : pathname
}

const navButtonClass = cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'size-8 shrink-0')

export function TablePagination({
  pathname,
  preservedQuery,
  currentPage,
  pageSize,
  totalItems,
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalItems)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className='text-xs text-muted-foreground tabular-nums'>
        {totalItems === 0 ? (
          'Tidak ada baris.'
        ) : (
          <>
            Baris {from}–{to} · {totalItems} total
          </>
        )}
      </p>
      <div className='flex items-center gap-1'>
        <Link
          href={buildHref(pathname, preservedQuery, 1)}
          aria-label='Halaman pertama'
          prefetch={false}
          aria-disabled={currentPage <= 1}
          className={cn(navButtonClass, currentPage <= 1 && 'pointer-events-none opacity-40')}
        >
          <ChevronsLeftIcon className='size-4' />
        </Link>
        <Link
          href={buildHref(pathname, preservedQuery, currentPage - 1)}
          aria-label='Halaman sebelumnya'
          prefetch={false}
          aria-disabled={currentPage <= 1}
          className={cn(navButtonClass, currentPage <= 1 && 'pointer-events-none opacity-40')}
        >
          <ChevronLeftIcon className='size-4' />
        </Link>
        <span
          className='min-w-18 rounded-md border bg-background/60 px-2 py-1 text-center text-xs tabular-nums text-muted-foreground'
          aria-live='polite'
        >
          {currentPage} / {totalPages}
        </span>
        <Link
          href={buildHref(pathname, preservedQuery, currentPage + 1)}
          aria-label='Halaman berikutnya'
          prefetch={false}
          aria-disabled={currentPage >= totalPages}
          className={cn(navButtonClass, currentPage >= totalPages && 'pointer-events-none opacity-40')}
        >
          <ChevronRightIcon className='size-4' />
        </Link>
        <Link
          href={buildHref(pathname, preservedQuery, totalPages)}
          aria-label='Halaman terakhir'
          prefetch={false}
          aria-disabled={currentPage >= totalPages}
          className={cn(navButtonClass, currentPage >= totalPages && 'pointer-events-none opacity-40')}
        >
          <ChevronsRightIcon className='size-4' />
        </Link>
      </div>
    </div>
  )
}
