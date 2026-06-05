import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { formatCurrencyIdr } from '@/components/admin/registration-detail-panels/shared/format'
import { cn } from '@/lib/utils'

type Props = {
  registration: DetailRegistration
  compact?: boolean
}

function holderNameById(registration: DetailRegistration, holderId: string): string {
  return registration.holders.find(h => h.id === holderId)?.holderName ?? '—'
}

const PRICE_SNAPSHOT_NOTES = [
  'Harga tiket sudah inklusif menu wajib.',
  'Nominal ini adalah snapshot saat pendaftar mengirim formulir.',
] as const

function PriceSnapshotNotes({ className }: { className?: string }) {
  return (
    <ul className={cn('grid gap-1 text-xs leading-relaxed text-foreground/75 dark:text-foreground/70', className)}>
      {PRICE_SNAPSHOT_NOTES.map(note => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  )
}

export function PriceSnapshotSection({ registration, compact = false }: Props) {
  const { tickets, computedTotalAtSubmit } = registration

  if (compact) {
    return (
      <div>
        <ul className='divide-y divide-border/50'>
          {tickets.map(t => (
            <li
              key={t.id}
              className='grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5 first:pt-0'
            >
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>
                  #{t.sortOrder} · {holderNameById(registration, t.assignedHolderId)}
                </p>
                {t.menuItemName ? (
                  <p className='mt-0.5 truncate text-xs text-muted-foreground'>{t.menuItemName}</p>
                ) : null}
              </div>
              <span className='shrink-0 text-sm tabular-nums text-muted-foreground'>
                {formatCurrencyIdr(t.ticketPriceApplied)}
              </span>
            </li>
          ))}
        </ul>
        <div className='-mx-4 mt-px border-t border-border/60'>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 bg-muted/40 px-4 py-3 dark:bg-muted/25'>
            <span className='text-sm font-semibold'>Total</span>
            <span className='shrink-0 text-sm font-semibold tabular-nums'>
              {formatCurrencyIdr(computedTotalAtSubmit)}
            </span>
          </div>
          <div className='border-t border-border/40 bg-muted/20 px-4 py-2.5 dark:bg-muted/10'>
            <PriceSnapshotNotes />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='grid gap-3 text-sm'>
      <ul className='grid gap-2'>
        {tickets.map(t => (
          <li key={t.id} className={cn('grid gap-2 rounded-lg border border-border/60 bg-muted/10 p-3')}>
            <p className='font-medium'>
              Tiket #{t.sortOrder} — {holderNameById(registration, t.assignedHolderId)}
            </p>
            <div className='flex flex-wrap justify-between gap-2'>
              <span className='text-muted-foreground'>Harga tiket (inklusif menu)</span>
              <span className='font-mono font-medium tabular-nums'>{formatCurrencyIdr(t.ticketPriceApplied)}</span>
            </div>
            {t.menuItemName ? <p className='text-xs text-muted-foreground'>Menu: {t.menuItemName}</p> : null}
          </li>
        ))}
      </ul>
      <div className='overflow-hidden rounded-lg border border-border/60'>
        <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 bg-muted/40 px-3 py-3 dark:bg-muted/25'>
          <span className='font-semibold'>Total dibayar saat kirim</span>
          <span className='shrink-0 font-semibold tabular-nums'>{formatCurrencyIdr(computedTotalAtSubmit)}</span>
        </div>
        <div className='border-t border-border/40 bg-muted/20 px-3 py-2.5 dark:bg-muted/10'>
          <PriceSnapshotNotes />
        </div>
      </div>
    </div>
  )
}
