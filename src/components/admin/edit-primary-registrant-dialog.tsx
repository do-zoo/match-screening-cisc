'use client'

import { useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { PencilIcon } from 'lucide-react'
import { useForm, type Resolver } from 'react-hook-form'

import { updatePrimaryRegistrant } from '@/lib/actions/admin-update-primary-registrant'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import {
  adminPrimaryRegistrantSchema,
  type AdminPrimaryRegistrantInput,
} from '@/lib/forms/admin-primary-registrant-schema'
import {
  getPrimaryHolder,
  resolveDetailRegistrationContact,
} from '@/lib/registrations/registration-primary-contact'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  eventId: string
  registration: DetailRegistration
}

function memberTypeLabel(memberType: DetailRegistration['holders'][0]['memberType']): string {
  if (memberType === 'tangsel') return 'Member Tangsel'
  if (memberType === 'regional') return 'Member regional'
  return 'Non-member'
}

export function EditPrimaryRegistrantDialog({ eventId, registration }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const primary = getPrimaryHolder(registration.holders)
  const contact = resolveDetailRegistrationContact(registration)
  const isMember = primary?.memberType === 'tangsel' || primary?.memberType === 'regional'

  const defaultValues: AdminPrimaryRegistrantInput = {
    registrationId: registration.id,
    holderName: contact.name,
    holderWhatsapp: contact.whatsapp,
    holderEmail: contact.email ?? '',
    claimedMemberNumber: primary?.claimedMemberNumber ?? '',
  }

  const form = useForm<AdminPrimaryRegistrantInput>({
    resolver: zodResolver(adminPrimaryRegistrantSchema as never) as Resolver<AdminPrimaryRegistrantInput>,
    defaultValues,
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) form.reset(defaultValues)
  }

  function onSubmit(values: AdminPrimaryRegistrantInput) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('payload', JSON.stringify(values))
      const result = await updatePrimaryRegistrant(eventId, undefined, fd)
      if (!result.ok) {
        toastActionErr(result)
        const fieldErrors = result.fieldErrors ?? {}
        for (const [field, message] of Object.entries(fieldErrors)) {
          form.setError(field as keyof AdminPrimaryRegistrantInput, { message })
        }
        return
      }
      toastCudSuccess('update', 'Data pemesan disimpan.')
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger disabled={pending} render={<Button variant='outline' size='sm' className='w-fit' />}>
        <PencilIcon className='size-3.5' aria-hidden />
        Edit pendaftar
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Edit pendaftar</DialogTitle>
          <DialogDescription>
            Mengubah data pemesan (holder #{primary?.sortOrder ?? 1}). Perubahan disinkronkan ke kontak transaksi
            registrasi.
          </DialogDescription>
        </DialogHeader>
        <form className='grid gap-4' onSubmit={form.handleSubmit(onSubmit)}>
          {primary?.memberType ? (
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs text-muted-foreground'>Tipe peserta</span>
              <Badge variant='outline'>{memberTypeLabel(primary.memberType)}</Badge>
            </div>
          ) : null}
          <div className='grid gap-1.5'>
            <Label htmlFor='edit-holderName'>Nama</Label>
            <Input id='edit-holderName' disabled={pending} {...form.register('holderName')} />
            {form.formState.errors.holderName ? (
              <p className='text-sm text-destructive'>{form.formState.errors.holderName.message}</p>
            ) : null}
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='edit-holderWhatsapp'>WhatsApp</Label>
            <Input id='edit-holderWhatsapp' disabled={pending} {...form.register('holderWhatsapp')} />
            {form.formState.errors.holderWhatsapp ? (
              <p className='text-sm text-destructive'>{form.formState.errors.holderWhatsapp.message}</p>
            ) : null}
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='edit-holderEmail'>Email</Label>
            <Input id='edit-holderEmail' type='email' autoComplete='email' disabled={pending} {...form.register('holderEmail')} />
            {form.formState.errors.holderEmail ? (
              <p className='text-sm text-destructive'>{form.formState.errors.holderEmail.message}</p>
            ) : null}
          </div>
          {isMember ? (
            <div className='grid gap-1.5'>
              <Label htmlFor='edit-claimedMemberNumber'>Nomor member</Label>
              <Input
                id='edit-claimedMemberNumber'
                disabled={pending}
                className='font-mono'
                {...form.register('claimedMemberNumber')}
              />
              {primary?.memberType === 'tangsel' ? (
                <p className='text-xs text-muted-foreground'>
                  Nomor dicek ke direktori Tangsel. Jika nomor berubah, status verifikasi member di-reset.
                </p>
              ) : (
                <p className='text-xs text-muted-foreground'>
                  Jika nomor berubah, status verifikasi member di-reset.
                </p>
              )}
              {form.formState.errors.claimedMemberNumber ? (
                <p className='text-sm text-destructive'>{form.formState.errors.claimedMemberNumber.message}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button type='button' variant='outline' disabled={pending} onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type='submit' disabled={pending}>
              {pending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
