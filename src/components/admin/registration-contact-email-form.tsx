'use client'

import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type Resolver } from 'react-hook-form'

import { updateRegistrationContactEmails } from '@/lib/actions/admin-registration-contact'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import {
  adminRegistrationContactSchema,
  type AdminRegistrationContactInput,
} from '@/lib/forms/admin-registration-contact-schema'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  eventId: string
  registration: DetailRegistration
}

export function RegistrationContactEmailForm({ eventId, registration }: Props) {
  const [pending, startTransition] = useTransition()

  const defaultValues: AdminRegistrationContactInput = {
    registrationId: registration.id,
    contactEmail: registration.contactEmail ?? '',
    holders: registration.holders.map(h => ({
      id: h.id,
      holderEmail: h.holderEmail ?? '',
    })),
  }

  const form = useForm<AdminRegistrationContactInput>({
    resolver: zodResolver(adminRegistrationContactSchema as never) as Resolver<AdminRegistrationContactInput>,
    defaultValues,
  })

  function onSubmit(values: AdminRegistrationContactInput) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('payload', JSON.stringify(values))
      const result = await updateRegistrationContactEmails(eventId, undefined, fd)
      if (!result.ok) {
        toastActionErr(result)
        const fieldErrors = result.fieldErrors ?? {}
        for (const [field, message] of Object.entries(fieldErrors)) {
          if (field === 'contactEmail' || field.startsWith('holders')) {
            form.setError(field as keyof AdminRegistrationContactInput, { message })
          }
        }
        return
      }
      toastCudSuccess('update', 'Email registrasi disimpan.')
    })
  }

  return (
    <form className='grid gap-3 rounded-md border bg-muted/30 p-3' onSubmit={form.handleSubmit(onSubmit)}>
      <div className='grid gap-1.5'>
        <Label htmlFor='contactEmail'>Email kontak</Label>
        <Input
          id='contactEmail'
          type='email'
          autoComplete='email'
          disabled={pending}
          {...form.register('contactEmail')}
        />
        {form.formState.errors.contactEmail ? (
          <p className='text-sm text-destructive'>{form.formState.errors.contactEmail.message}</p>
        ) : null}
      </div>
      {registration.holders.length > 1 ? (
        <div className='grid gap-2'>
          <p className='text-xs font-medium text-muted-foreground'>Email per pemegang tiket (opsional)</p>
          {registration.holders.map((h, index) => (
            <div key={h.id} className='grid gap-1'>
              <Label htmlFor={`holder-email-${h.id}`}>
                Holder #{h.sortOrder} — {h.holderName}
              </Label>
              <Input
                id={`holder-email-${h.id}`}
                type='email'
                disabled={pending}
                {...form.register(`holders.${index}.holderEmail`)}
              />
            </div>
          ))}
        </div>
      ) : null}
      <Button type='submit' size='sm' disabled={pending} className='w-fit'>
        {pending ? 'Menyimpan…' : 'Simpan email'}
      </Button>
    </form>
  )
}
