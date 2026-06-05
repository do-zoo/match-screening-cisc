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
  payload: RegistrationNotifyPayload | null
}

export function RegistrationNotifyDialog({ open, onOpenChange, payload }: Props) {
  if (!payload) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{payload.titleId}</DialogTitle>
          <DialogDescription>
            Kirim notifikasi WhatsApp ke pendaftar? Pesan dapat diedit di aplikasi WhatsApp setelah dibuka.
          </DialogDescription>
        </DialogHeader>
        <pre className='max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap'>
          {payload.preview}
        </pre>
        {!payload.canOpen && payload.disabledReasonId ? (
          <p className='text-sm text-muted-foreground'>{payload.disabledReasonId}</p>
        ) : null}
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Lewati
          </Button>
          {payload.canOpen ? (
            <a
              target='_blank'
              rel='noopener noreferrer'
              href={payload.href}
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
