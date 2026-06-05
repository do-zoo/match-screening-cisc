'use client'

import { useState } from 'react'

import { RegistrationCommsDialog } from '@/components/admin/registration-comms-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { AttendanceSection } from '@/components/admin/registration-detail-panels/tab-operations/attendance-section'
import { InvoiceAdjustmentsSection } from '@/components/admin/registration-detail-panels/tab-operations/invoice-adjustments-section'
import { CancelRefundSection } from '@/components/admin/registration-detail-panels/tab-operations/cancel-refund-section'
import {
  buildRegistrationWaNotify,
  type RegistrationNotifyKind,
  type RegistrationNotifyPayload,
} from '@/lib/wa-templates/build-registration-notify'
import { resolveDetailRegistrationContact } from '@/lib/registrations/registration-primary-contact'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'
import { notifyInputFromDetailRegistration } from '@/lib/wa-templates/notify-input-from-detail-registration'

type Props = {
  eventId: string
  registration: DetailRegistration
  waBodies: ClubWaBodies
}

export function OperationsTabClient({ eventId, registration, waBodies }: Props) {
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyPayload, setNotifyPayload] = useState<RegistrationNotifyPayload | null>(null)
  const [notifyKind, setNotifyKind] = useState<RegistrationNotifyKind | null>(null)

  const contact = resolveDetailRegistrationContact(registration)
  const notifyInput = notifyInputFromDetailRegistration(registration, contact)

  function openNotify(kind: RegistrationNotifyKind, adjustmentAmountIdr?: number) {
    setNotifyKind(kind)
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
        <CardHeader className='border-b border-border/60 pb-4'>
          <CardTitle>Operasi</CardTitle>
          <CardDescription>
            Catat kehadiran, kelola penyesuaian invoice, atau batalkan dan refund pendaftaran yang sudah disetujui.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 p-4 md:gap-5 md:p-6'>
          <div className='grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-5'>
            <AttendanceSection eventId={eventId} registration={registration} />
            <InvoiceAdjustmentsSection
              eventId={eventId}
              registration={registration}
              onUnderpaymentEmailSent={amount => openNotify('underpayment_email_reminder', amount)}
            />
          </div>
          <CancelRefundSection
            eventId={eventId}
            registration={registration}
            onCancelSuccess={() => openNotify('cancelled')}
            onRefundSuccess={() => openNotify('refunded')}
          />
        </CardContent>
      </Card>
      {notifyKind ? (
        <RegistrationCommsDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          wa={notifyPayload}
        />
      ) : null}
    </>
  )
}
