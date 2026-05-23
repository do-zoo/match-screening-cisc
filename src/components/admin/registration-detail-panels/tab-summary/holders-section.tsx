import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { formatCurrencyIdr } from '@/components/admin/registration-detail-panels/shared/format'

type Props = {
  registration: DetailRegistration
}

function memberValidationLabel(v: string): string {
  if (v === 'verified') return 'Terverifikasi'
  if (v === 'rejected') return 'Ditolak'
  return 'Belum diverifikasi'
}

export function HoldersSection({ registration }: Props) {
  const { holders, ticketCategory, ticketQty } = registration

  return (
    <div className='grid gap-3 text-sm'>
      <div className='flex flex-wrap justify-between gap-2'>
        <span className='text-muted-foreground'>Kategori tiket</span>
        <span className='font-medium'>{ticketCategory.name}</span>
      </div>
      <div className='flex flex-wrap justify-between gap-2'>
        <span className='text-muted-foreground'>Jumlah tiket</span>
        <span className='font-medium'>{ticketQty}</span>
      </div>
      <div className='overflow-x-auto rounded-md border'>
        <table className='w-full text-sm'>
          <thead className='bg-muted/50'>
            <tr>
              <th className='px-3 py-2 text-left font-medium'>#</th>
              <th className='px-3 py-2 text-left font-medium'>Nama</th>
              <th className='px-3 py-2 text-left font-medium'>No. Member</th>
              <th className='px-3 py-2 text-left font-medium'>Status</th>
              <th className='px-3 py-2 text-left font-medium'>Menu</th>
              <th className='px-3 py-2 text-right font-medium'>Harga</th>
            </tr>
          </thead>
          <tbody>
            {holders.map(h => (
              <tr key={h.id} className='border-t'>
                <td className='px-3 py-2 text-muted-foreground'>{h.sortOrder}</td>
                <td className='px-3 py-2 font-medium'>{h.holderName}</td>
                <td className='px-3 py-2'>{h.claimedMemberNumber ?? '—'}</td>
                <td className='px-3 py-2'>{memberValidationLabel(h.memberValidation)}</td>
                <td className='px-3 py-2'>{h.menuItemName ?? '—'}</td>
                <td className='px-3 py-2 text-right font-mono'>{formatCurrencyIdr(h.ticketPriceApplied)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
