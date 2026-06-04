'use client'

import { Button } from '@/components/ui/button'
import { rootError } from '@/lib/forms/action-result'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'

type CopyProps = {
  label: string
  text: string
}

export function CopyTextButton({ label, text }: CopyProps) {
  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      className='shrink-0'
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          toastCudSuccess('update', 'Nomor rekening disalin.')
        } catch {
          toastActionErr(rootError('Gagal menyalin.'), 'Gagal menyalin.')
        }
      }}
    >
      {label}
    </Button>
  )
}
