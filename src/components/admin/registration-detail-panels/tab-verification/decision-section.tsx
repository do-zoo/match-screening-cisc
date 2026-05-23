'use client'

import { useState } from 'react'
import { RegistrationStatus } from '@prisma/client'

import { RegistrationActions } from '@/components/admin/registration-actions'
import { Button } from '@/components/ui/button'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'

type Props = {
  eventId: string
  registration: DetailRegistration
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
  return ''
}

export function DecisionSection({ eventId, registration }: Props) {
  const isTerminal = TERMINAL.has(registration.status)
  const [showActions, setShowActions] = useState(!isTerminal)

  return (
    <div className='grid gap-4'>
      <div className='text-sm text-muted-foreground'>
        Status saat ini: <span className='font-medium text-foreground'>{STATUS_LABEL_ID[registration.status]}</span>
      </div>

      {isTerminal && !showActions ? (
        <div className='flex flex-col gap-3 rounded-lg border bg-muted/20 p-4'>
          <p className='text-sm'>{statusSummary(registration.status)}</p>
          <Button type='button' variant='outline' size='sm' className='self-start' onClick={() => setShowActions(true)}>
            Ubah keputusan
          </Button>
        </div>
      ) : (
        <RegistrationActions eventId={eventId} registrationId={registration.id} />
      )}
    </div>
  )
}
