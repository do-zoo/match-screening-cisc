'use client'

import { useState, useTransition } from 'react'
import { RegistrationStatus } from '@prisma/client'
import { AlertCircleIcon, CheckIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { approveRegistration, rejectRegistration, markPaymentIssue } from '@/lib/actions/verify-registration'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import type { RegistrationNotifyInput, RegistrationNotifyKind } from '@/lib/wa-templates/build-registration-notify'
import { cn } from '@/lib/utils'

type Props = {
  eventId: string
  registrationId: string
  onSuccess?: (result: {
    status: RegistrationStatus
    rejectionReason?: string | null
    paymentIssueReason?: string | null
  }) => void
  onNotify?: (
    kind: RegistrationNotifyKind,
    overrides?: Partial<Pick<RegistrationNotifyInput, 'rejectionReason' | 'paymentIssueReason'>>,
  ) => void
}

type ActivePanel = 'reject' | 'payment' | null

export function RegistrationActions({ eventId, registrationId, onSuccess, onNotify }: Props) {
  const [isPending, startTransition] = useTransition()
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)

  const [paymentReason, setPaymentReason] = useState('')
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const [approveError, setApproveError] = useState<string | null>(null)

  function closePanels() {
    setActivePanel(null)
    setRejectReason('')
    setPaymentReason('')
    setRejectError(null)
    setPaymentError(null)
  }

  function handleApprove() {
    setApproveError(null)
    closePanels()
    startTransition(async () => {
      const result = await approveRegistration(eventId, registrationId)
      if (!result.ok) {
        toastActionErr(result)
        setApproveError(result.rootError ?? 'Terjadi kesalahan.')
      } else {
        toastCudSuccess('update', 'Pendaftaran disetujui.')
        onSuccess?.({
          status: RegistrationStatus.approved,
          rejectionReason: null,
          paymentIssueReason: null,
        })
        onNotify?.('approved')
      }
    })
  }

  function handleReject() {
    setRejectError(null)
    startTransition(async () => {
      const result = await rejectRegistration(eventId, registrationId, rejectReason)
      if (!result.ok) {
        toastActionErr(result)
        setRejectError(result.rootError ?? 'Terjadi kesalahan.')
      } else {
        toastCudSuccess('update', 'Pendaftaran ditolak.')
        closePanels()
        const trimmed = rejectReason.trim()
        onSuccess?.({
          status: RegistrationStatus.rejected,
          rejectionReason: trimmed,
          paymentIssueReason: null,
        })
        onNotify?.('rejected', { rejectionReason: trimmed })
      }
    })
  }

  function handlePaymentIssue() {
    setPaymentError(null)
    startTransition(async () => {
      const result = await markPaymentIssue(eventId, registrationId, paymentReason)
      if (!result.ok) {
        toastActionErr(result)
        setPaymentError(result.rootError ?? 'Terjadi kesalahan.')
      } else {
        toastCudSuccess('update', 'Status pembayaran diperbarui.')
        closePanels()
        const trimmed = paymentReason.trim()
        onSuccess?.({
          status: RegistrationStatus.payment_issue,
          rejectionReason: null,
          paymentIssueReason: trimmed,
        })
        onNotify?.('payment_issue', { paymentIssueReason: trimmed })
      }
    })
  }

  const showActionRow = activePanel === null

  return (
    <div className='grid gap-3'>
      {showActionRow ? (
        <div className='grid gap-2'>
          <Button
            variant='default'
            className='w-full justify-center gap-2'
            disabled={isPending}
            onClick={handleApprove}
          >
            <CheckIcon className='size-4' aria-hidden />
            Setujui
          </Button>
          <div className='grid grid-cols-2 gap-2'>
            <Button
              variant='destructive'
              className='justify-center gap-1.5'
              disabled={isPending}
              onClick={() => setActivePanel('reject')}
            >
              <XIcon className='size-4' aria-hidden />
              Tolak
            </Button>
            <Button
              variant='outline'
              className={cn(
                'justify-center gap-1.5 border-amber-500/40 text-amber-950 hover:bg-amber-500/10',
                'dark:border-amber-500/30 dark:text-amber-100 dark:hover:bg-amber-500/10',
              )}
              disabled={isPending}
              onClick={() => setActivePanel('payment')}
            >
              <AlertCircleIcon className='size-4' aria-hidden />
              Kendala bayar
            </Button>
          </div>
        </div>
      ) : null}

      {approveError ? <p className='text-sm text-destructive'>{approveError}</p> : null}

      {activePanel === 'reject' ? (
        <div className='grid gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3'>
          <p className='text-sm font-medium'>Alasan penolakan</p>
          <Textarea
            placeholder='Tuliskan alasan penolakan...'
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            disabled={isPending}
            autoFocus
          />
          {rejectError ? <p className='text-sm text-destructive'>{rejectError}</p> : null}
          <div className='flex flex-wrap gap-2'>
            <Button variant='destructive' size='sm' disabled={isPending} onClick={handleReject}>
              Konfirmasi tolak
            </Button>
            <Button variant='outline' size='sm' disabled={isPending} onClick={closePanels}>
              Batal
            </Button>
          </div>
        </div>
      ) : null}

      {activePanel === 'payment' ? (
        <div className='grid gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3'>
          <p className='text-sm font-medium'>Alasan kendala pembayaran</p>
          <Textarea
            placeholder='Tuliskan masalah pembayaran...'
            value={paymentReason}
            onChange={e => setPaymentReason(e.target.value)}
            rows={3}
            disabled={isPending}
            autoFocus
          />
          {paymentError ? <p className='text-sm text-destructive'>{paymentError}</p> : null}
          <div className='flex flex-wrap gap-2'>
            <Button variant='default' size='sm' disabled={isPending} onClick={handlePaymentIssue}>
              Konfirmasi kendala
            </Button>
            <Button variant='outline' size='sm' disabled={isPending} onClick={closePanels}>
              Batal
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
