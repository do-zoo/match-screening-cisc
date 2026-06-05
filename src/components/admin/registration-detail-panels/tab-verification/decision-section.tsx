'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RegistrationStatus } from '@prisma/client'

import { RegistrationActions } from '@/components/admin/registration-actions'
import { RegistrationNotifyDialog } from '@/components/admin/registration-notify-dialog'
import { RegistrationStatusBadge } from '@/components/admin/registration-status-badge'
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
import { resolveDetailRegistrationContact } from '@/lib/registrations/registration-primary-contact'
import type { ClubWaBodies } from '@/lib/wa-templates/render-wa-from-db'

type Props = {
  eventId: string
  registration: DetailRegistration
  waBodies: ClubWaBodies
}

type DecisionSnapshot = {
  status: RegistrationStatus
  rejectionReason: string | null
  paymentIssueReason: string | null
}

const STATUS_LABEL_ID: Record<RegistrationStatus, string> = {
  submitted: 'Terkirim',
  pending_review: 'Menunggu tinjauan',
  payment_issue: 'Kendala pembayaran',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
  refunded: 'Refund',
}

function needsActionPanel(status: RegistrationStatus): boolean {
  return status === RegistrationStatus.submitted || status === RegistrationStatus.pending_review
}

function hasDecisionSummary(status: RegistrationStatus): boolean {
  return !needsActionPanel(status)
}

function statusSummary(status: RegistrationStatus): string {
  if (status === RegistrationStatus.approved) return 'Pendaftaran telah disetujui.'
  if (status === RegistrationStatus.rejected) return 'Pendaftaran ditolak.'
  if (status === RegistrationStatus.cancelled) return 'Pendaftaran dibatalkan.'
  if (status === RegistrationStatus.refunded) return 'Pendaftaran ditandai refund.'
  if (status === RegistrationStatus.payment_issue) return 'Menunggu klarifikasi pembayaran.'
  return ''
}

function snapshotFromRegistration(registration: DetailRegistration): DecisionSnapshot {
  return {
    status: registration.status,
    rejectionReason: registration.rejectionReason,
    paymentIssueReason: registration.paymentIssueReason,
  }
}

export function DecisionSection({ eventId, registration, waBodies }: Props) {
  const router = useRouter()
  const [showActions, setShowActions] = useState(() => needsActionPanel(registration.status))
  const [decision, setDecision] = useState<DecisionSnapshot>(() => snapshotFromRegistration(registration))
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyPayload, setNotifyPayload] = useState<RegistrationNotifyPayload | null>(null)

  useEffect(() => {
    setDecision(snapshotFromRegistration(registration))
    setShowActions(needsActionPanel(registration.status))
  }, [registration.id, registration.status, registration.rejectionReason, registration.paymentIssueReason])

  const contact = resolveDetailRegistrationContact(registration)
  const notifyInput = {
    contactName: contact.name,
    contactWhatsapp: contact.whatsapp,
    rejectionReason: decision.rejectionReason,
    paymentIssueReason: decision.paymentIssueReason,
    event: registration.event,
  }

  function openNotify(
    kind: RegistrationNotifyKind,
    overrides?: Partial<Pick<RegistrationNotifyInput, 'rejectionReason' | 'paymentIssueReason'>>,
  ) {
    setNotifyPayload(
      buildRegistrationWaNotify({ kind, registration: { ...notifyInput, ...overrides }, waBodies }),
    )
    setNotifyOpen(true)
  }

  function handleDecisionSuccess(result: {
    status: RegistrationStatus
    rejectionReason?: string | null
    paymentIssueReason?: string | null
  }) {
    setDecision({
      status: result.status,
      rejectionReason: result.rejectionReason ?? null,
      paymentIssueReason: result.paymentIssueReason ?? null,
    })
    setShowActions(false)
    router.refresh()
  }

  const showResend = canResendNotifyForStatus(decision.status, notifyInput, waBodies)
  const resendKind = resendNotifyKindForStatus(decision.status)

  return (
    <div className='rounded-xl border border-border/80 bg-card'>
      <div className='flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3'>
        <h3 className='text-sm font-semibold tracking-tight'>Keputusan verifikasi</h3>
        <RegistrationStatusBadge status={decision.status} />
      </div>

      <div className='grid gap-4 p-4'>
        <p className='text-sm text-muted-foreground'>
          Status:{' '}
          <span className='font-medium text-foreground'>{STATUS_LABEL_ID[decision.status]}</span>
        </p>

        {!showActions && hasDecisionSummary(decision.status) ? (
          <div className='grid gap-3 rounded-lg border border-dashed bg-muted/20 p-3'>
            <p className='text-sm leading-relaxed'>{statusSummary(decision.status)}</p>
            {decision.rejectionReason ? (
              <p className='text-sm text-muted-foreground'>
                <span className='font-medium text-foreground'>Alasan: </span>
                {decision.rejectionReason}
              </p>
            ) : null}
            {decision.paymentIssueReason ? (
              <p className='text-sm text-muted-foreground'>
                <span className='font-medium text-foreground'>Catatan: </span>
                {decision.paymentIssueReason}
              </p>
            ) : null}
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
            <RegistrationActions
              eventId={eventId}
              registrationId={registration.id}
              onSuccess={handleDecisionSuccess}
              onNotify={openNotify}
            />
            {showResend && resendKind ? (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='self-start px-0 text-muted-foreground hover:text-foreground'
                onClick={() => openNotify(resendKind)}
              >
                Kirim ulang notifikasi WhatsApp
              </Button>
            ) : null}
          </>
        )}
      </div>

      <RegistrationNotifyDialog open={notifyOpen} onOpenChange={setNotifyOpen} payload={notifyPayload} />
    </div>
  )
}
