'use client'

import { useActionState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { EventStatus } from '@prisma/client'
import { Loader2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { deleteVenue } from '@/lib/actions/admin-venues'
import { toastActionErr } from '@/lib/client/cud-notify'
import type { ActionResult } from '@/lib/forms/action-result'
import { partitionVenueLinkedEvents } from '@/lib/venues/venue-delete-eligibility'
import { VENUE_LINKED_EVENT_STATUS_LABEL } from '@/lib/venues/venue-event-status-label'

export type VenueLinkedEventRow = {
  id: string
  title: string
  status: EventStatus
  registrationCount: number
}

type Props = {
  venueId: string
  venueName: string
  linkedEvents: VenueLinkedEventRow[]
}

export function VenueDeletePanel({ venueId, venueName, linkedEvents }: Props) {
  const [state, dispatch, isPending] = useActionState(deleteVenue, null as ActionResult<{ deleted: true }> | null)

  const { blocking, draftsToRemove, canDeleteVenue } = useMemo(
    () => partitionVenueLinkedEvents(linkedEvents),
    [linkedEvents],
  )

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

      {!canDeleteVenue ? (
        <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
          <p>
            Venue tidak bisa dihapus karena masih dipakai{' '}
            <strong>
              {blocking.length} acara yang memblokir penghapusan
            </strong>
            {blocking.some(e => e.status === 'draft' && e.registrationCount > 0)
              ? ' atau draf yang punya registrasi'
              : ''}
            . Hapus atau ubah venue pada acara berikut terlebih dahulu:
          </p>
          <ul className='m-0 list-none space-y-2 p-0'>
            {blocking.map(event => (
              <li key={event.id}>
                <Link
                  href={`/admin/events/${event.id}/edit`}
                  className='inline-flex flex-wrap items-center gap-2 underline-offset-4 hover:underline'
                >
                  <Badge variant='secondary' className='font-normal'>
                    {VENUE_LINKED_EVENT_STATUS_LABEL[event.status]}
                  </Badge>
                  <span className='font-medium text-foreground'>{event.title}</span>
                  {event.registrationCount > 0 ? (
                    <span className='text-xs'>({event.registrationCount} registrasi)</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <p className='text-xs'>
            Acara berstatus <strong>Draf</strong> tidak tampil di tab Aktif indeks acara — cek tab{' '}
            <Link href='/admin/events?tab=draft' className='underline-offset-4 hover:underline'>
              Draf
            </Link>{' '}
            atau <strong>Semua</strong>.
          </p>
        </div>
      ) : (
        <Dialog>
          <DialogTrigger disabled={isPending} render={<Button variant='destructive' className='w-fit' />}>
            Hapus venue
          </DialogTrigger>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>Hapus venue</DialogTitle>
              <DialogDescription>
                Menghapus <strong>{venueName}</strong> secara permanen beserta semua item menu kanoniknya.
                {draftsToRemove.length > 0 ? (
                  <>
                    {' '}
                    {draftsToRemove.length === 1 ? '1 acara draf' : `${draftsToRemove.length} acara draf`} tanpa
                    registrasi juga akan ikut dihapus.
                  </>
                ) : null}{' '}
                Tindakan ini tidak bisa dibatalkan.
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
