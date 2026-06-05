'use client'

import { useTransition } from 'react'

import { sendRegistrationApprovedEmailToRegistration } from '@/lib/actions/admin-registration-approved-email'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { Button } from '@/components/ui/button'

export function SendPaymentProofEmailButton({
  eventId,
  registrationId,
  disabled,
}: {
  eventId: string
  registrationId: string
  disabled?: boolean
}) {
  const [pending, start] = useTransition()

  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      disabled={disabled || pending}
      onClick={() => {
        start(async () => {
          const r = await sendRegistrationApprovedEmailToRegistration(eventId, registrationId)
          if (!r.ok) toastActionErr(r)
          else if (r.data.dryRun) {
            toastCudSuccess('update', 'Bukti pembayaran tercatat (mode uji).')
          } else {
            toastCudSuccess('update', 'Bukti pembayaran dikirim via email.')
          }
        })
      }}
    >
      {pending ? 'Mengirim…' : 'Kirim ulang bukti email'}
    </Button>
  )
}
