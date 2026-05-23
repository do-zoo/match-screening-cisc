import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { registrationDetailDateFormatter } from '@/components/admin/registration-detail-panels/shared/format'
import { CopyTextButton } from '@/components/admin/registration-detail-panels/tab-summary/copy-text-button'

type Props = {
  registration: DetailRegistration
}

export function EventContextSection({ registration }: Props) {
  const ev = registration.event
  const bank = ev.bankAccount

  return (
    <div className='grid gap-2 text-sm'>
      <div className='font-medium'>Acara</div>
      <div>{ev.title}</div>
      <div className='text-muted-foreground'>{ev.venueName}</div>
      <div className='text-muted-foreground'>{registrationDetailDateFormatter.format(ev.kickOffAt)}</div>
      {bank ? (
        <div className='mt-2 rounded-lg border bg-muted/20 p-3'>
          <div className='mb-2 font-medium'>Rekening pembayaran</div>
          <div className='grid gap-1 text-muted-foreground'>
            <div>{bank.bankName}</div>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-mono text-foreground'>{bank.accountNumber}</span>
              <CopyTextButton label='Salin nomor rekening' text={bank.accountNumber} />
            </div>
            <div>a.n. {bank.accountName}</div>
          </div>
        </div>
      ) : (
        <p className='text-muted-foreground'>Rekening pembayaran belum dikonfigurasi.</p>
      )}
    </div>
  )
}
