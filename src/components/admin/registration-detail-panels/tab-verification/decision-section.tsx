'use client'

import { useState } from 'react'
import { RegistrationStatus } from '@prisma/client'

import { RegistrationActions } from '@/components/admin/registration-actions'
import { RegistrationNotifyDialog } from '@/components/admin/registration-notify-dialog'
import { Button } from '@/components/ui/button'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import {
  buildRegistrationWaNotify,
  canResendNotifyForStatus,
  resendNotifyKindForStatus,
  type RegistrationNotifyInput,
  type RegistrationNotifyKind,
  type RegistrationNotifyPayload,
} from '@/lib/wa-templates/build-registration-notify'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'

type Props = {
  eventId: string
  registration: DetailRegistration
  waBodies: ClubWaBodies
}

const TERMINAL = new Set<RegistrationStatus>([
  RegistrationStatus.approved,
  RegistrationStatus.rejected,
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
])

const STATUS_LABEL_ID: Record<RegistrationStatus, string> = {
  submitted: 'Terkirim',
  pending_review: 'Menunggu tinjauan',
  payment_issue: 'Kendala pembayaran',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
  refunded: 'Refund',
}

function statusSummary(status: RegistrationStatus): string {
  if (status === RegistrationStatus.approved) return 'Pendaftaran telah disetujui.'
  if (status === RegistrationStatus.rejected) return 'Pendaftaran ditolak.'
  if (status === RegistrationStatus.cancelled) return 'Pendaftaran dibatalkan.'
  if (status === RegistrationStatus.refunded) return 'Pendaftaran ditandai refund.'
  if (status === RegistrationStatus.payment_issue) return 'Menunggu klarifikasi pembayaran.'
  return ''
}

export function DecisionSection({ eventId, registration, waBodies }: Props) {
  const isTerminal = TERMINAL.has(registration.status)
  const [showActions, setShowActions] = useState(!isTerminal)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyPayload, setNotifyPayload] = useState<RegistrationNotifyPayload | null>(null)

  const notifyInput = {
    contactName: registration.contactName,
    contactWhatsapp: registration.contactWhatsapp,
    rejectionReason: registration.rejectionReason,
    paymentIssueReason: registration.paymentIssueReason,
    event: registration.event,
  }

  function openNotify(
    kind: RegistrationNotifyKind,
    overrides?: Pick<RegistrationNotifyInput, 'rejectionReason' | 'paymentIssueReason'>,
  ) {
    setNotifyPayload(
      buildRegistrationWaNotify({ kind, registration: { ...notifyInput, ...overrides }, waBodies }),
    )
    setNotifyOpen(true)
  }

  const showResend = canResendNotifyForStatus(registration.status, notifyInput, waBodies)
  const resendKind = resendNotifyKindForStatus(registration.status)

  return (
    <div className='grid gap-4'>
      <div className='text-sm text-muted-foreground'>
        Status saat ini: <span className='font-medium text-foreground'>{STATUS_LABEL_ID[registration.status]}</span>
      </div>

      {isTerminal && !showActions ? (
        <div className='flex flex-col gap-3 rounded-lg border bg-muted/20 p-4'>
          <p className='text-sm'>{statusSummary(registration.status)}</p>
          <div className='flex flex-wrap gap-2'>
            <Button type='button' variant='outline' size='sm' onClick={() => setShowActions(true)}>
              Ubah keputusan
            </Button>
            {showResend && resendKind ? (
              <Button type='button' variant='outline' size='sm' onClick={() => openNotify(resendKind)}>
                Kirim ulang notifikasi
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <RegistrationActions eventId={eventId} registrationId={registration.id} onNotify={openNotify} />
          {showResend && resendKind ? (
            <Button type='button' variant='outline' size='sm' className='self-start' onClick={() => openNotify(resendKind)}>
              Kirim ulang notifikasi
            </Button>
          ) : null}
        </>
      )}

      <RegistrationNotifyDialog open={notifyOpen} onOpenChange={setNotifyOpen} payload={notifyPayload} />
    </div>
  )
}
