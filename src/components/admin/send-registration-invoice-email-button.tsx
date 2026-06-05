'use client'

import { useTransition } from 'react'

import { sendRegistrationInvoiceEmailToRegistration } from '@/lib/actions/admin-registration-invoice-email'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { Button } from '@/components/ui/button'

export function SendRegistrationInvoiceEmailButton({
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
          const r = await sendRegistrationInvoiceEmailToRegistration(eventId, registrationId)
          if (!r.ok) toastActionErr(r)
          else toastCudSuccess('update', 'Email tagihan pendaftaran terkirim.')
        })
      }}
    >
      {pending ? 'Mengirim…' : 'Kirim tagihan pendaftaran (email)'}
    </Button>
  )
}
