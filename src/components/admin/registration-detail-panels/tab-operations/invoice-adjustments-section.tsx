import { InvoiceAdjustmentPanel } from '@/components/admin/invoice-adjustment-panel'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'

type Props = {
  eventId: string
  registration: DetailRegistration
  onUnderpaymentEmailSent?: (adjustmentAmountIdr: number) => void
}

export function InvoiceAdjustmentsSection({ eventId, registration, onUnderpaymentEmailSent }: Props) {
  return (
    <InvoiceAdjustmentPanel
      eventId={eventId}
      registrationId={registration.id}
      adjustments={registration.adjustments}
      contactEmail={registration.contactEmail}
      onUnderpaymentEmailSent={onUnderpaymentEmailSent}
    />
  )
}
