import { InvoiceAdjustmentPanel } from '@/components/admin/invoice-adjustment-panel'
import { SendRegistrationInvoiceEmailButton } from '@/components/admin/send-registration-invoice-email-button'
import { resolveDetailRegistrationContact } from '@/lib/registrations/registration-primary-contact'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { OperationSectionShell } from '@/components/admin/registration-detail-panels/tab-operations/operation-section-shell'
import { Badge } from '@/components/ui/badge'

type Props = {
  eventId: string
  registration: DetailRegistration
  onUnderpaymentEmailSent?: (adjustmentAmountIdr: number) => void
}

export function InvoiceAdjustmentsSection({ eventId, registration, onUnderpaymentEmailSent }: Props) {
  const contact = resolveDetailRegistrationContact(registration)
  const unpaidCount = registration.adjustments.filter(a => a.status === 'unpaid').length

  return (
    <OperationSectionShell
      title='Penyesuaian invoice'
      description='Tagihan kekurangan bayar dan bukti pelunasan tambahan.'
      headerEnd={
        registration.adjustments.length > 0 ? (
          <Badge variant='outline' className='shrink-0 tabular-nums'>
            {registration.adjustments.length} item
            {unpaidCount > 0 ? ` · ${unpaidCount} belum lunas` : ''}
          </Badge>
        ) : null
      }
    >
      {contact.email && unpaidCount === 0 ? (
        <div className='flex flex-wrap gap-2'>
          <SendRegistrationInvoiceEmailButton eventId={eventId} registrationId={registration.id} />
        </div>
      ) : null}
      <InvoiceAdjustmentPanel
        eventId={eventId}
        registrationId={registration.id}
        adjustments={registration.adjustments}
        contactEmail={contact.email}
        onUnderpaymentEmailSent={onUnderpaymentEmailSent}
      />
    </OperationSectionShell>
  )
}
