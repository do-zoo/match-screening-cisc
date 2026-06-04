import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { registrationDetailDateFormatter } from '@/components/admin/registration-detail-panels/shared/format'
import { RegistrationContactEmailForm } from '@/components/admin/registration-contact-email-form'

type Props = {
  eventId: string
  registration: DetailRegistration
}

export function IdentitySection({ eventId, registration }: Props) {
  return (
    <div className='grid gap-3 text-sm'>
      <div className='grid gap-2'>
        <div className='font-medium'>{registration.contactName}</div>
        <div className='text-muted-foreground'>{registration.contactWhatsapp}</div>
        {registration.contactEmail ? (
          <div className='text-muted-foreground'>{registration.contactEmail}</div>
        ) : (
          <div className='text-sm text-amber-700 dark:text-amber-400'>Email kontak belum diisi.</div>
        )}
        <div className='text-muted-foreground'>
          Dikirim {registrationDetailDateFormatter.format(registration.createdAt)}
        </div>
        <div className='font-mono text-xs text-muted-foreground'>{registration.id}</div>
      </div>
      <RegistrationContactEmailForm eventId={eventId} registration={registration} />
    </div>
  )
}
