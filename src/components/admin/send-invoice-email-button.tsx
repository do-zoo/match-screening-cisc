'use client'

import { useTransition } from 'react'

import { sendInvoiceEmailToRegistration } from '@/lib/actions/admin-invoice-email-blast'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { Button } from '@/components/ui/button'

export function SendInvoiceEmailButton({
  eventId,
  registrationId,
  disabled,
  onSuccess,
}: {
  eventId: string
  registrationId: string
  disabled?: boolean
  onSuccess?: () => void
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
          const r = await sendInvoiceEmailToRegistration(eventId, registrationId)
          if (!r.ok) toastActionErr(r)
          else {
            toastCudSuccess('update', 'Email tagihan kekurangan terkirim.')
            onSuccess?.()
          }
        })
      }}
    >
      {pending ? 'Mengirim…' : 'Kirim tagihan kekurangan (email)'}
    </Button>
  )
}
