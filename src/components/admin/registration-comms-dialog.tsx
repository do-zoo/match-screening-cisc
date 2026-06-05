'use client'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { RegistrationNotifyPayload } from '@/lib/wa-templates/build-registration-notify'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  wa: RegistrationNotifyPayload | null
}

export function RegistrationCommsDialog({ open, onOpenChange, wa }: Props) {
  if (!wa) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{wa.titleId}</DialogTitle>
          <DialogDescription>
            Kirim notifikasi ke pendaftar via WhatsApp. Pesan dapat diedit di aplikasi WhatsApp setelah dibuka.
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className='text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide'>WhatsApp</p>
          <pre className='max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap'>
            {wa.preview}
          </pre>
        </div>

        {!wa.canOpen && wa.disabledReasonId ? (
          <p className='text-sm text-muted-foreground'>{wa.disabledReasonId}</p>
        ) : null}

        <DialogFooter className='flex-col gap-2 sm:flex-row sm:justify-end'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Lewati
          </Button>
          {wa.canOpen ? (
            <a
              target='_blank'
              rel='noopener noreferrer'
              href={wa.href}
              onClick={() => onOpenChange(false)}
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
