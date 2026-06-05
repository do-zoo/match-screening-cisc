'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'

import { RegistrationInvoicePdfDialogContent } from '@/components/admin/registration-invoice-pdf-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogTrigger,
} from '@/components/ui/dialog'

type Props = {
  label: string
  dialogTitle: string
  previewUrl: string
  downloadUrl: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
}

export function RegistrationInvoicePdfButton({
  label,
  dialogTitle,
  previewUrl,
  downloadUrl,
  variant = 'outline',
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type='button' variant={variant} size='sm' className='gap-1.5 w-fit' />}>
        <FileDown className='size-3.5' aria-hidden />
        {label}
      </DialogTrigger>
      <RegistrationInvoicePdfDialogContent
        title={dialogTitle}
        previewUrl={previewUrl}
        downloadUrl={downloadUrl}
        onClose={() => setOpen(false)}
      />
    </Dialog>
  )
}
