'use client'

import { useActionState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { deleteVenue } from '@/lib/actions/admin-venues'
import { toastActionErr } from '@/lib/client/cud-notify'
import type { ActionResult } from '@/lib/forms/action-result'

type Props = {
  venueId: string
  venueName: string
  eventCount: number
}

export function VenueDeletePanel({ venueId, venueName, eventCount }: Props) {
  const [state, dispatch, isPending] = useActionState(deleteVenue, null as ActionResult<{ deleted: true }> | null)

  useEffect(() => {
    if (state?.ok === false) toastActionErr(state)
  }, [state])

  return (
    <section className='flex flex-col gap-4 rounded-lg border border-destructive/40 p-4 md:p-6'>
      <div>
        <h2 className='text-base font-semibold text-destructive'>Zona berbahaya</h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Tindakan di bawah ini bersifat permanen dan tidak bisa dibatalkan.
        </p>
      </div>

      {eventCount > 0 ? (
        <p className='text-sm text-muted-foreground'>
          Venue tidak bisa dihapus karena digunakan oleh <strong>{eventCount} acara</strong>. Hapus atau ubah venue pada
          acara terkait terlebih dahulu jika ingin menghapus venue ini.
        </p>
      ) : (
        <Dialog>
          <DialogTrigger disabled={isPending} render={<Button variant='destructive' className='w-fit' />}>
            Hapus venue
          </DialogTrigger>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>Hapus venue</DialogTitle>
              <DialogDescription>
                Menghapus <strong>{venueName}</strong> secara permanen beserta semua item menu kanoniknya. Tindakan ini
                tidak bisa dibatalkan.
              </DialogDescription>
            </DialogHeader>
            {state?.ok === false && state.rootError ? (
              <Alert variant='destructive'>
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{state.rootError}</AlertDescription>
              </Alert>
            ) : null}
            <form action={dispatch}>
              <input type='hidden' name='venueId' value={venueId} />
              <DialogFooter>
                <Button type='submit' variant='destructive' disabled={isPending}>
                  {isPending ? <Loader2 className='size-4 animate-spin' /> : 'Ya, hapus venue'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}
