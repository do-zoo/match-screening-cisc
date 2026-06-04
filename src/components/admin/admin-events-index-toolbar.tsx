'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutGridIcon, Table2Icon } from 'lucide-react'

import type { EventsIndexViewMode } from '@/lib/admin/events-index-view'
import { buildAdminEventsIndexUrl } from '@/lib/admin/events-index-view'
import type { EventsIndexStatusTab } from '@/lib/admin/events-index-view-model'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const SEARCH_DEBOUNCE_MS = 350

const statusOptions: { tab: EventsIndexStatusTab; label: string }[] = [
  { tab: 'all', label: 'Semua status' },
  { tab: 'active', label: 'Aktif' },
  { tab: 'draft', label: 'Draf' },
  { tab: 'finished', label: 'Selesai' },
]

export function AdminEventsIndexToolbar({
  tab,
  viewMode,
  isOps,
  searchQuery,
}: {
  tab: EventsIndexStatusTab
  viewMode: EventsIndexViewMode
  isOps: boolean
  searchQuery: string
}) {
  const router = useRouter()
  const [draftQ, setDraftQ] = React.useState(searchQuery)

  // URL `q` dari server; field cari harus mengikuti navigasi (hasil debounce, Hapus filter, history).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron controlled input ke `searchParams.q`
    setDraftQ(searchQuery)
  }, [searchQuery])

  React.useEffect(() => {
    const trimmed = draftQ.trim()
    const nextQ = trimmed.length > 0 ? trimmed : undefined
    const currentTrimmed = searchQuery.trim()
    const currentQ = currentTrimmed.length > 0 ? currentTrimmed : undefined
    if (nextQ === currentQ) return

    const id = window.setTimeout(() => {
      router.push(
        buildAdminEventsIndexUrl({
          tab,
          view: viewMode,
          q: nextQ,
        }),
      )
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(id)
  }, [draftQ, searchQuery, tab, viewMode, router])

  const qForNav = draftQ.trim()
  const qForUrl = qForNav.length > 0 ? qForNav : undefined

  function push(url: string) {
    router.push(url)
  }

  return (
    <div className='rounded-lg border bg-card p-4 shadow-sm'>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4'>
          <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
            <Label htmlFor='admin-events-search' className='text-xs text-muted-foreground'>
              Cari acara
            </Label>
            <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2'>
              <Input
                id='admin-events-search'
                name='q'
                type='search'
                autoComplete='off'
                placeholder='Judul, slug, atau venue…'
                value={draftQ}
                onChange={e => setDraftQ(e.target.value)}
                className='w-full min-w-0'
              />
              {searchQuery.trim() ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='shrink-0 self-start text-muted-foreground sm:self-auto'
                  onClick={() => {
                    setDraftQ('')
                    push(
                      buildAdminEventsIndexUrl({
                        tab,
                        view: viewMode,
                      }),
                    )
                  }}
                >
                  Hapus filter
                </Button>
              ) : null}
            </div>
          </div>

          <div className='flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[12rem]'>
            <Label htmlFor='admin-events-status' className='text-xs text-muted-foreground'>
              Status acara
            </Label>
            <Select
              value={tab}
              onValueChange={v => {
                if (v === null) return
                push(
                  buildAdminEventsIndexUrl({
                    tab: v as EventsIndexStatusTab,
                    view: viewMode,
                    q: qForUrl,
                  }),
                )
              }}
            >
              <SelectTrigger id='admin-events-status' size='sm' className='w-full min-w-0 sm:w-56'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(({ tab: key, label }) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isOps ? (
            <div
              className='flex shrink-0 rounded-lg border bg-muted/30 p-0.5 sm:ml-auto'
              role='group'
              aria-label='Bentuk daftar acara'
            >
              <Link
                href={buildAdminEventsIndexUrl({ tab, view: 'cards', q: qForUrl })}
                aria-label='Tampilan kartu'
                title='Tampilan kartu'
                className={cn(
                  buttonVariants({
                    variant: viewMode === 'cards' ? 'secondary' : 'ghost',
                    size: 'icon-sm',
                    className: 'size-8 rounded-md shadow-none',
                  }),
                )}
              >
                <LayoutGridIcon className='size-4' />
              </Link>
              <Link
                href={buildAdminEventsIndexUrl({ tab, view: 'table', q: qForUrl })}
                aria-label='Tampilan tabel'
                title='Tampilan tabel'
                className={cn(
                  buttonVariants({
                    variant: viewMode === 'table' ? 'secondary' : 'ghost',
                    size: 'icon-sm',
                    className: 'size-8 rounded-md shadow-none',
                  }),
                )}
              >
                <Table2Icon className='size-4' />
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
