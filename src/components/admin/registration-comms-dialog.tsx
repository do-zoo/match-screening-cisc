'use client'

import { useEffect, useState, useTransition } from 'react'

import { Loader2 } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  previewRegistrationCommsEmail,
  sendRegistrationCommsEmail,
} from '@/lib/actions/admin-registration-lifecycle-email'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import type { RegistrationNotifyKind, RegistrationNotifyPayload } from '@/lib/wa-templates/build-registration-notify'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  wa: RegistrationNotifyPayload | null
  eventId: string
  registrationId: string
  kind: RegistrationNotifyKind
  contactEmail: string | null
}

export function RegistrationCommsDialog({
  open,
  onOpenChange,
  wa,
  eventId,
  registrationId,
  kind,
  contactEmail,
}: Props) {
  const [emailPreview, setEmailPreview] = useState<{ subject: string; textPreview: string } | null>(null)
  const [emailLoadError, setEmailLoadError] = useState<string | null>(null)
  const [previewPending, startPreview] = useTransition()
  const [sendPending, startSend] = useTransition()

  const canSendEmail = kind !== 'underpayment_email_reminder' && !!contactEmail?.trim()

  function handleOpenChange(next: boolean) {
    if (!next) {
      setEmailPreview(null)
      setEmailLoadError(null)
    }
    onOpenChange(next)
  }

  useEffect(() => {
    if (!open || !canSendEmail) return
    startPreview(async () => {
      setEmailLoadError(null)
      const res = await previewRegistrationCommsEmail(eventId, registrationId, kind)
      if (!res.ok) {
        setEmailPreview(null)
        setEmailLoadError(res.rootError ?? 'Gagal memuat pratinjau email.')
        return
      }
      setEmailPreview(res.data)
    })
  }, [open, canSendEmail, eventId, registrationId, kind])

  if (!wa) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{wa.titleId}</DialogTitle>
          <DialogDescription>
            Notifikasi ke pendaftar via WhatsApp dan/atau email. Pesan WA dapat diedit di aplikasi WhatsApp setelah
            dibuka.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div>
            <p className='text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide'>WhatsApp</p>
            <pre className='max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap'>
              {wa.preview}
            </pre>
          </div>

          {canSendEmail ? (
            <div>
              <p className='text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide'>Email</p>
              {previewPending ? (
                <p className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <Loader2 className='size-4 animate-spin' aria-hidden />
                  Memuat pratinjau…
                </p>
              ) : emailLoadError ? (
                <p className='text-muted-foreground text-sm'>{emailLoadError}</p>
              ) : emailPreview ? (
                <div className='space-y-2 rounded-md border bg-muted/20 p-3 text-sm'>
                  <p className='font-medium'>{emailPreview.subject}</p>
                  <pre className='text-muted-foreground max-h-32 overflow-y-auto text-xs whitespace-pre-wrap'>
                    {emailPreview.textPreview}
                  </pre>
                </div>
              ) : (
                <p className='text-muted-foreground text-sm'>Pratinjau email tidak tersedia.</p>
              )}
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {kind === 'underpayment_email_reminder'
                ? 'Email tagihan sudah dikirim dari panel penyesuaian. Gunakan WhatsApp sebagai pengingat.'
                : 'Email kontak kosong — tidak dapat mengirim email.'}
            </p>
          )}
        </div>

        {!wa.canOpen && wa.disabledReasonId ? (
          <p className='text-sm text-muted-foreground'>{wa.disabledReasonId}</p>
        ) : null}

        <DialogFooter className='flex-col gap-2 sm:flex-row sm:justify-end'>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>
            Lewati
          </Button>
          {canSendEmail ? (
            <Button
              type='button'
              variant='secondary'
              disabled={sendPending || previewPending}
              onClick={() => {
                startSend(async () => {
                  const res = await sendRegistrationCommsEmail(eventId, registrationId, kind)
                  if (!res.ok) {
                    toastActionErr(res)
                    return
                  }
                  if (res.data?.ok) {
                    toastCudSuccess('update', res.data.dryRun ? 'Email dicatat (mode log).' : 'Email terkirim.')
                  }
                  handleOpenChange(false)
                })
              }}
            >
              {sendPending ? (
                <>
                  <Loader2 className='mr-2 size-4 animate-spin' aria-hidden />
                  Mengirim…
                </>
              ) : (
                'Kirim email'
              )}
            </Button>
          ) : null}
          {wa.canOpen ? (
            <a
              target='_blank'
              rel='noopener noreferrer'
              href={wa.href}
              onClick={() => handleOpenChange(false)}
              className={buttonVariants()}
            >
              Buka WhatsApp
            </a>
          ) : (
            <Button type='button' disabled>
              Buka WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
