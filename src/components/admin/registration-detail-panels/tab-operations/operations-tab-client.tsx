'use client'

import { useState } from 'react'

import { RegistrationNotifyDialog } from '@/components/admin/registration-notify-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { AttendanceSection } from '@/components/admin/registration-detail-panels/tab-operations/attendance-section'
import { InvoiceAdjustmentsSection } from '@/components/admin/registration-detail-panels/tab-operations/invoice-adjustments-section'
import { CancelRefundSection } from '@/components/admin/registration-detail-panels/tab-operations/cancel-refund-section'
import {
  buildRegistrationWaNotify,
  type RegistrationNotifyKind,
  type RegistrationNotifyPayload,
} from '@/lib/wa-templates/build-registration-notify'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'

type Props = {
  eventId: string
  registration: DetailRegistration
  waBodies: ClubWaBodies
}

export function OperationsTabClient({ eventId, registration, waBodies }: Props) {
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyPayload, setNotifyPayload] = useState<RegistrationNotifyPayload | null>(null)

  const notifyInput = {
    contactName: registration.contactName,
    contactWhatsapp: registration.contactWhatsapp,
    rejectionReason: registration.rejectionReason,
    paymentIssueReason: registration.paymentIssueReason,
    event: registration.event,
  }

  function openNotify(kind: RegistrationNotifyKind, adjustmentAmountIdr?: number) {
    setNotifyPayload(
      buildRegistrationWaNotify({
        kind,
        registration: notifyInput,
        waBodies,
        adjustmentAmountIdr,
      }),
    )
    setNotifyOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Operasi</CardTitle>
          <CardDescription>Kehadiran, penyesuaian invoice, dan pembatalan atau refund.</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 md:p-6'>
          <AttendanceSection eventId={eventId} registration={registration} />
          <Separator />
          <InvoiceAdjustmentsSection
            eventId={eventId}
            registration={registration}
            onUnderpaymentEmailSent={amount => openNotify('underpayment_email_reminder', amount)}
          />
          <Separator />
          <CancelRefundSection
            eventId={eventId}
            registration={registration}
            onCancelSuccess={() => openNotify('cancelled')}
            onRefundSuccess={() => openNotify('refunded')}
          />
        </CardContent>
      </Card>
      <RegistrationNotifyDialog open={notifyOpen} onOpenChange={setNotifyOpen} payload={notifyPayload} />
    </>
  )
}
