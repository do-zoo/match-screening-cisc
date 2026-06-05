'use client'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ContentProps = {
  title: string
  previewUrl: string
  downloadUrl: string
  onClose: () => void
}

export function RegistrationInvoicePdfDialogContent({
  title,
  previewUrl,
  downloadUrl,
  onClose,
}: ContentProps) {
  return (
    <DialogContent className='flex max-h-[90vh] flex-col gap-4 sm:max-w-4xl'>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <iframe
        src={previewUrl}
        title={title}
        className='h-[70vh] w-full rounded-md border'
      />
      <DialogFooter className='gap-2 sm:gap-0'>
        <Button type='button' variant='outline' onClick={onClose}>
          Tutup
        </Button>
        <a href={downloadUrl} download className={buttonVariants()}>
          Unduh PDF
        </a>
      </DialogFooter>
    </DialogContent>
  )
}

type Props = ContentProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RegistrationInvoicePdfDialog({
  open,
  onOpenChange,
  title,
  previewUrl,
  downloadUrl,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <RegistrationInvoicePdfDialogContent
        title={title}
        previewUrl={previewUrl}
        downloadUrl={downloadUrl}
        onClose={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
