'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutGridIcon, Table2Icon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const DEFAULT_SEARCH_DEBOUNCE_MS = 350

/** Cache draft antar remount (mis. halaman anggota dengan wrapper client penuh). */
const searchDraftByInputId = new Map<string, string>()
/** Query yang belum/sedang di-push ke URL — mencegah sinkron menimpa saat mengetik. */
const pendingSearchQByInputId = new Map<string, string | undefined>()

function normalizeSearchQuery(raw: string): string | undefined {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function resolveInitialDraft(inputId: string, serverValue: string): string {
  const cached = searchDraftByInputId.get(inputId)
  if (cached === undefined) return serverValue

  const cachedQ = normalizeSearchQuery(cached)
  const serverQ = normalizeSearchQuery(serverValue)
  const pending = pendingSearchQByInputId.get(inputId)

  if (cachedQ === serverQ) return cached

  if (pending !== undefined) {
    if (serverQ === undefined && cachedQ !== undefined) return cached
    if (serverQ !== undefined && cached.startsWith(serverValue.trim()) && cached.length >= serverValue.trim().length) {
      return cached
    }
  }

  if (serverQ === undefined && cachedQ !== undefined && pending === undefined) {
    searchDraftByInputId.delete(inputId)
    return serverValue
  }

  return serverValue
}

export type AdminListToolbarSearchConfig = {
  inputId: string
  label: string
  placeholder: string
  /** Nilai `q` dari server — field sinkron saat navigasi/history. */
  value: string
  debounceMs?: number
  /** URL tujuan setelah debounce; `q` kosih → `undefined`. */
  getUrlForQuery: (q: string | undefined) => string
}

export type AdminListToolbarViewToggleConfig = {
  mode: 'table' | 'cards'
  tableHref: string
  cardsHref: string
  disabled?: boolean
}

type AdminListToolbarProps = {
  className?: string
  search?: AdminListToolbarSearchConfig
  viewToggle?: AdminListToolbarViewToggleConfig
  /** Mis. Select filter — navigasi manual lewat `Link` / `router.push`. */
  filterSlot?: React.ReactNode
  /** Mis. tombol aksi utama di kanan. */
  endSlot?: React.ReactNode
}

/**
 * Toolbar daftar admin generik: pencarian bertekanan URL (debounce),
 * opsi toggle tabel/kartu lewat `Link`, slot filter, dan slot aksi.
 */
export function AdminListToolbar({ className, search, viewToggle, filterSlot, endSlot }: AdminListToolbarProps) {
  const router = useRouter()
  const [draftQ, setDraftQ] = React.useState(() =>
    search ? resolveInitialDraft(search.inputId, search.value) : '',
  )
  const getUrlForQueryRef = React.useRef(search?.getUrlForQuery)
  const isSearchFocusedRef = React.useRef(false)
  const draftQRef = React.useRef(draftQ)

  React.useLayoutEffect(() => {
    draftQRef.current = draftQ
  }, [draftQ])

  React.useLayoutEffect(() => {
    getUrlForQueryRef.current = search?.getUrlForQuery
  }, [search?.getUrlForQuery])

  React.useEffect(() => {
    if (!search) return
    searchDraftByInputId.set(search.inputId, draftQ)
  }, [draftQ, search?.inputId, search])

  React.useEffect(() => {
    if (!search) return

    const serverQ = normalizeSearchQuery(search.value)
    const pending = pendingSearchQByInputId.get(search.inputId)

    if (pending !== undefined && serverQ === pending) {
      pendingSearchQByInputId.delete(search.inputId)
      const draftNorm = normalizeSearchQuery(draftQRef.current)
      if (draftNorm !== serverQ) return
    }

    const isFocused =
      isSearchFocusedRef.current ||
      (search.inputId.length > 0 && document.activeElement?.id === search.inputId)
    if (isFocused) return

    searchDraftByInputId.set(search.inputId, search.value)
    setDraftQ(search.value)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hindari dependensi objek `search` (identitas baru tiap render)
  }, [search?.value, search?.inputId])

  React.useEffect(() => {
    if (!search) return
    const debounceMs = search.debounceMs ?? DEFAULT_SEARCH_DEBOUNCE_MS
    const trimmed = draftQ.trim()
    const nextQ = trimmed.length > 0 ? trimmed : undefined
    const currentTrimmed = search.value.trim()
    const currentQ = currentTrimmed.length > 0 ? currentTrimmed : undefined
    if (nextQ === currentQ) return

    const id = window.setTimeout(() => {
      pendingSearchQByInputId.set(search.inputId, nextQ)
      const href = getUrlForQueryRef.current?.(nextQ)
      if (href) router.push(href)
    }, debounceMs)

    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `getUrlForQuery` lewat ref; hindari dependensi objek `search`
  }, [draftQ, search?.value, search?.debounceMs, search?.inputId, router])

  function handleSearchChange(next: string) {
    setDraftQ(next)
    if (!search) return
    searchDraftByInputId.set(search.inputId, next)
    const nextQ = normalizeSearchQuery(next)
    const currentQ = normalizeSearchQuery(search.value)
    if (nextQ !== currentQ) {
      pendingSearchQByInputId.set(search.inputId, nextQ)
    }
  }

  const clearSearchHref = search?.getUrlForQuery(undefined)
  const showClearSearch =
    search !== undefined &&
    search.value.trim().length > 0 &&
    typeof clearSearchHref === 'string' &&
    clearSearchHref.length > 0

  return (
    <div className={cn('rounded-lg border border-border/80 bg-card p-4 shadow-sm', className)}>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4'>
          {search ? (
            <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
              <Label htmlFor={search.inputId} className='text-muted-foreground text-xs'>
                {search.label}
              </Label>
              <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2'>
                <Input
                  id={search.inputId}
                  name='q'
                  type='search'
                  autoComplete='off'
                  placeholder={search.placeholder}
                  value={draftQ}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => {
                    isSearchFocusedRef.current = true
                  }}
                  onBlur={() => {
                    isSearchFocusedRef.current = false
                  }}
                  className='w-full min-w-0'
                />
                {showClearSearch ? (
                  <Link
                    href={clearSearchHref}
                    prefetch={false}
                    onClick={() => {
                      pendingSearchQByInputId.delete(search.inputId)
                      searchDraftByInputId.set(search.inputId, '')
                    }}
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'sm' }),
                      'text-muted-foreground shrink-0 self-start sm:self-auto',
                    )}
                  >
                    Hapus filter
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {filterSlot ? (
            <div className='flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[12rem]'>{filterSlot}</div>
          ) : null}

          <div className='flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end'>
            {viewToggle ? (
              <div
                className='bg-muted/60 flex shrink-0 rounded-lg border p-0.5'
                role='group'
                aria-label='Bentuk daftar'
              >
                <Link
                  href={viewToggle.tableHref}
                  prefetch={false}
                  aria-label='Tampilan tabel'
                  title='Tampilan tabel'
                  aria-disabled={viewToggle.disabled}
                  className={cn(
                    buttonVariants({
                      variant: viewToggle.mode === 'table' ? 'secondary' : 'ghost',
                      size: 'icon-sm',
                      className: 'size-8 rounded-md shadow-none',
                    }),
                    viewToggle.disabled && 'pointer-events-none opacity-50',
                  )}
                >
                  <Table2Icon className='size-4' />
                </Link>
                <Link
                  href={viewToggle.cardsHref}
                  prefetch={false}
                  aria-label='Tampilan kartu'
                  title='Tampilan kartu'
                  aria-disabled={viewToggle.disabled}
                  className={cn(
                    buttonVariants({
                      variant: viewToggle.mode === 'cards' ? 'secondary' : 'ghost',
                      size: 'icon-sm',
                      className: 'size-8 rounded-md shadow-none',
                    }),
                    viewToggle.disabled && 'pointer-events-none opacity-50',
                  )}
                >
                  <LayoutGridIcon className='size-4' />
                </Link>
              </div>
            ) : null}
            {endSlot ? <div className='flex shrink-0 items-center'>{endSlot}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
