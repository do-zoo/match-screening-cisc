import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { formatCurrencyIdr } from '@/components/admin/registration-detail-panels/shared/format'

type Props = {
  registration: DetailRegistration
}

export function PriceSnapshotSection({ registration }: Props) {
  const { holders, computedTotalAtSubmit } = registration

  return (
    <div className='grid gap-2 text-sm'>
      <div className='font-medium'>Rincian harga (snapshot)</div>
      {holders.map((h, index) => (
        <div key={h.id} className={index === 0 ? 'grid gap-2' : 'grid gap-2 border-t pt-2'}>
          <div className='font-medium text-muted-foreground'>
            Pemegang #{h.sortOrder} — {h.holderName}
          </div>
          <div className='flex flex-wrap justify-between gap-2'>
            <span className='text-muted-foreground'>Harga tiket (termasuk menu wajib)</span>
            <span className='font-mono font-medium'>{formatCurrencyIdr(h.ticketPriceApplied)}</span>
          </div>
          {h.menuItemName ? (
            <div className='text-xs leading-relaxed text-muted-foreground'>Menu: {h.menuItemName}</div>
          ) : null}
        </div>
      ))}
      <div className='flex flex-wrap justify-between gap-2 border-t pt-2'>
        <span className='font-medium'>Total dibayar saat kirim</span>
        <span className='font-mono text-base font-semibold'>{formatCurrencyIdr(computedTotalAtSubmit)}</span>
      </div>
    </div>
  )
}
