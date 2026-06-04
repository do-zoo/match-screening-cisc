import type { ReactNode } from 'react'
import { MailIcon, PhoneIcon } from 'lucide-react'

import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { registrationDetailDateFormatter } from '@/components/admin/registration-detail-panels/shared/format'
import { RegistrationContactEmailForm } from '@/components/admin/registration-contact-email-form'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Props = {
  eventId: string
  registration: DetailRegistration
}

function DetailRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start sm:gap-3', className)}>
      <dt className='text-xs font-medium text-muted-foreground sm:pt-0.5'>{label}</dt>
      <dd className='min-w-0 text-sm'>{children}</dd>
    </div>
  )
}

export function IdentitySection({ eventId, registration }: Props) {
  return (
    <div className='grid gap-4'>
      <dl className='grid gap-3'>
        <DetailRow label='Nama'>
          <span className='font-medium'>{registration.contactName}</span>
        </DetailRow>
        <DetailRow label='WhatsApp'>
          <span className='inline-flex items-center gap-1.5'>
            <PhoneIcon className='size-3.5 shrink-0 text-muted-foreground' aria-hidden />
            {registration.contactWhatsapp}
          </span>
        </DetailRow>
        <DetailRow label='Email'>
          {registration.contactEmail ? (
            <span className='inline-flex items-center gap-1.5 break-all'>
              <MailIcon className='size-3.5 shrink-0 text-muted-foreground' aria-hidden />
              {registration.contactEmail}
            </span>
          ) : (
            <Badge
              variant='outline'
              className='border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
            >
              Email belum diisi
            </Badge>
          )}
        </DetailRow>
        <DetailRow label='Dikirim'>
          <span className='text-muted-foreground'>
            {registrationDetailDateFormatter.format(registration.createdAt)}
          </span>
        </DetailRow>
        <DetailRow label='ID'>
          <code className='block break-all rounded-md bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground'>
            {registration.id}
          </code>
        </DetailRow>
      </dl>

      <RegistrationContactEmailForm eventId={eventId} registration={registration} />
    </div>
  )
}
