'use client'

import { useActionState } from 'react'

import { createVenueMinimal } from '@/lib/actions/admin-venues'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResult } from '@/lib/forms/action-result'

export function AdminNewVenueForm() {
  const [state, dispatch, pending] = useActionState(
    createVenueMinimal,
    null as ActionResult<{ venueId: string }> | null,
  )

  return (
    <form action={dispatch} className='grid gap-4'>
      {state?.ok === false && state.rootError ? (
        <Alert variant='destructive'>
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{state.rootError}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok === false && state.fieldErrors ? (
        <Alert variant='destructive'>
          <AlertTitle>Periksa isian</AlertTitle>
          <AlertDescription className='font-mono text-xs whitespace-pre-wrap'>
            {Object.entries(state.fieldErrors)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n')}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className='grid gap-2'>
        <Label htmlFor='name'>Nama venue</Label>
        <Input id='name' name='name' required autoComplete='off' disabled={pending} />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='address'>Alamat</Label>
        <Textarea id='address' name='address' rows={3} required disabled={pending} />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='mapUrl'>Tautan peta (opsional)</Label>
        <Input
          id='mapUrl'
          name='mapUrl'
          type='url'
          inputMode='url'
          autoComplete='off'
          placeholder='https://maps.app.goo.gl/…'
          disabled={pending}
        />
        <p className='text-muted-foreground text-xs'>URL https ke Google Maps atau layanan peta lain.</p>
      </div>
      <Button type='submit' disabled={pending} className='w-fit'>
        {pending ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </form>
  )
}
