import { CancelRefundPanel } from '@/components/admin/cancel-refund-panel'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'

type Props = {
  eventId: string
  registration: DetailRegistration
}

export function CancelRefundSection({ eventId, registration }: Props) {
  return <CancelRefundPanel eventId={eventId} registrationId={registration.id} status={registration.status} />
}
