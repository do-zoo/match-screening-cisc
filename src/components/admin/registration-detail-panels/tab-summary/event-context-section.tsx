import type { ReactNode } from 'react'
import { Building2Icon, CalendarIcon, CreditCardIcon, MapPinIcon } from 'lucide-react'

import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { registrationDetailDateFormatter } from '@/components/admin/registration-detail-panels/shared/format'
import { CopyTextButton } from '@/components/admin/registration-detail-panels/tab-summary/copy-text-button'
import { cn } from '@/lib/utils'

type Props = {
  registration: DetailRegistration
}

function ContextRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className='flex gap-3'>
      <div className='flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30'>
        <Icon className='size-4 text-muted-foreground' aria-hidden />
      </div>
      <div className='min-w-0 grid gap-0.5'>
        <p className='text-xs font-medium text-muted-foreground'>{label}</p>
        <div className='text-sm'>{children}</div>
      </div>
    </div>
  )
}

export function EventContextSection({ registration }: Props) {
  const ev = registration.event
  const bank = ev.bankAccount

  return (
    <div className='grid gap-4'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <ContextRow icon={CalendarIcon} label='Acara'>
          <p className='font-medium leading-snug'>{ev.title}</p>
        </ContextRow>
        <ContextRow icon={MapPinIcon} label='Venue'>
          <p className='leading-snug'>{ev.venueName}</p>
          <p className='text-muted-foreground'>{registrationDetailDateFormatter.format(ev.kickOffAt)}</p>
        </ContextRow>
      </div>

      {bank ? (
        <div className='rounded-xl border border-border/80 bg-muted/10 p-4'>
          <div className='mb-3 flex items-center gap-2'>
            <CreditCardIcon className='size-4 text-muted-foreground' aria-hidden />
            <p className='text-sm font-semibold'>Rekening pembayaran</p>
          </div>
          <dl className='grid gap-2 text-sm'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <dt className='text-muted-foreground'>Bank</dt>
              <dd className='font-medium'>{bank.bankName}</dd>
            </div>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <dt className='text-muted-foreground'>Nomor rekening</dt>
              <dd className='flex flex-wrap items-center gap-2'>
                <code className={cn('rounded-md bg-background/80 px-2 py-0.5 font-mono text-sm')}>
                  {bank.accountNumber}
                </code>
                <CopyTextButton label='Salin' text={bank.accountNumber} />
              </dd>
            </div>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <dt className='text-muted-foreground'>Atas nama</dt>
              <dd>{bank.accountName}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className='flex items-start gap-3 rounded-xl border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground'>
          <Building2Icon className='mt-0.5 size-4 shrink-0' aria-hidden />
          <p>Rekening pembayaran belum dikonfigurasi untuk acara ini.</p>
        </div>
      )}
    </div>
  )
}
