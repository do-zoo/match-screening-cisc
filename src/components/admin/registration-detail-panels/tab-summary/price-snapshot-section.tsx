import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { formatCurrencyIdr } from '@/components/admin/registration-detail-panels/shared/format'
import { cn } from '@/lib/utils'

type Props = {
  registration: DetailRegistration
  compact?: boolean
}

export function PriceSnapshotSection({ registration, compact = false }: Props) {
  const { holders, computedTotalAtSubmit } = registration

  if (compact) {
    return (
      <div className='grid gap-3'>
        <ul className='grid gap-2'>
          {holders.map(h => (
            <li key={h.id} className='flex items-start justify-between gap-3 text-sm'>
              <div className='min-w-0'>
                <p className='font-medium leading-snug'>
                  #{h.sortOrder} · {h.holderName}
                </p>
                {h.menuItemName ? (
                  <p className='mt-0.5 truncate text-xs text-muted-foreground'>{h.menuItemName}</p>
                ) : null}
              </div>
              <span className='shrink-0 font-mono text-sm tabular-nums'>{formatCurrencyIdr(h.ticketPriceApplied)}</span>
            </li>
          ))}
        </ul>
        <div className='flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5'>
          <span className='text-sm font-medium'>Total saat kirim</span>
          <span className='font-mono text-base font-semibold tabular-nums'>{formatCurrencyIdr(computedTotalAtSubmit)}</span>
        </div>
        <p className='text-xs leading-relaxed text-muted-foreground'>
          Harga tiket sudah inklusif menu wajib. Nominal ini adalah snapshot saat pendaftar mengirim formulir.
        </p>
      </div>
    )
  }

  return (
    <div className='grid gap-3 text-sm'>
      <ul className='grid gap-2'>
        {holders.map(h => (
          <li
            key={h.id}
            className={cn('grid gap-2 rounded-lg border border-border/60 bg-muted/10 p-3', h.sortOrder > 1 && '')}
          >
            <p className='font-medium'>
              Pemegang #{h.sortOrder} — {h.holderName}
            </p>
            <div className='flex flex-wrap justify-between gap-2'>
              <span className='text-muted-foreground'>Harga tiket (inklusif menu)</span>
              <span className='font-mono font-medium tabular-nums'>{formatCurrencyIdr(h.ticketPriceApplied)}</span>
            </div>
            {h.menuItemName ? <p className='text-xs text-muted-foreground'>Menu: {h.menuItemName}</p> : null}
          </li>
        ))}
      </ul>
      <div className='flex flex-wrap justify-between gap-2 border-t border-border/60 pt-3'>
        <span className='font-medium'>Total dibayar saat kirim</span>
        <span className='font-mono text-base font-semibold tabular-nums'>{formatCurrencyIdr(computedTotalAtSubmit)}</span>
      </div>
    </div>
  )
}
