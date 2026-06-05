import { RegistrationStatus } from '@prisma/client'

import { CancelRefundPanel } from '@/components/admin/cancel-refund-panel'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { OperationSectionShell } from '@/components/admin/registration-detail-panels/tab-operations/operation-section-shell'

type Props = {
  eventId: string
  registration: DetailRegistration
  onCancelSuccess?: () => void
  onRefundSuccess?: () => void
}

const CANCEL_BLOCKED_FROM = new Set<RegistrationStatus>([
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
  RegistrationStatus.rejected,
])

const REFUND_ALLOWED_FROM = new Set<RegistrationStatus>([RegistrationStatus.approved, RegistrationStatus.cancelled])

export function CancelRefundSection({ eventId, registration, onCancelSuccess, onRefundSuccess }: Props) {
  const canCancel = !CANCEL_BLOCKED_FROM.has(registration.status)
  const canRefund = REFUND_ALLOWED_FROM.has(registration.status)

  if (!canCancel && !canRefund) return null

  return (
    <OperationSectionShell
      title='Pembatalan & refund'
      description='Aksi terminal — pastikan keputusan sudah final sebelum melanjutkan.'
      variant='danger'
    >
      <CancelRefundPanel
        eventId={eventId}
        registrationId={registration.id}
        status={registration.status}
        onCancelSuccess={onCancelSuccess}
        onRefundSuccess={onRefundSuccess}
      />
    </OperationSectionShell>
  )
}
