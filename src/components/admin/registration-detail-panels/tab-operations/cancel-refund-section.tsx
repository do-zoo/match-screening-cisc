import { CancelRefundPanel } from '@/components/admin/cancel-refund-panel'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'

type Props = {
  eventId: string
  registration: DetailRegistration
  onCancelSuccess?: () => void
  onRefundSuccess?: () => void
}

export function CancelRefundSection({ eventId, registration, onCancelSuccess, onRefundSuccess }: Props) {
  return (
    <CancelRefundPanel
      eventId={eventId}
      registrationId={registration.id}
      status={registration.status}
      onCancelSuccess={onCancelSuccess}
      onRefundSuccess={onRefundSuccess}
    />
  )
}
