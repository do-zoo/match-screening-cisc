'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button, buttonVariants } from '@/components/ui/button'
import { FileField } from '@/components/ui/file-field'
import { uploadTransferProof } from '@/lib/actions/upload-transfer-proof'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { formatIdr } from '@/lib/utils/format-idr'
import { cn } from '@/lib/utils'

type Props = {
  registrationId: string
  eventTitle: string
  bankName: string
  accountName: string
  accountNumber: string
  totalAmount: number
}

export function UploadProofPanel({
  registrationId,
  eventTitle,
  bankName,
  accountName,
  accountNumber,
  totalAmount,
}: Props) {
  const router = useRouter()
  const [file, setFile] = useState<File | undefined>(undefined)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setIsPending(true)
    const formData = new FormData()
    formData.append('transferProof', file)
    const result = await uploadTransferProof(registrationId, formData)
    setIsPending(false)
    if (result.ok) {
      toastCudSuccess('create', 'Bukti transfer berhasil dikirim.')
      router.refresh()
    } else {
      toastActionErr(result)
    }
  }

  return (
    <main className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 md:px-6'>
      <header className='flex flex-col gap-2'>
        <h1 className='text-2xl font-semibold tracking-tight'>Pendaftaran diterima!</h1>
        <p className='text-sm text-muted-foreground'>
          Selesaikan pembayaran untuk mengkonfirmasi tempatmu di{' '}
          <span className='font-medium text-foreground'>{eventTitle}</span>.
        </p>
      </header>

      <section className='grid gap-2 rounded-lg border bg-card p-4 text-sm md:p-6'>
        <p className='font-medium'>Transfer ke</p>
        <p>
          <span className='font-semibold'>{bankName}</span> — {accountName}
        </p>
        <p className='font-mono text-base'>{accountNumber}</p>
        <p className='text-lg font-bold tabular-nums'>{formatIdr(totalAmount)}</p>
      </section>

      <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
        <FileField
          id='upload-proof'
          label='Bukti transfer'
          description='Upload screenshot atau foto bukti transfer (JPG, PNG, WebP). Pastikan nominal dan nama penerima terbaca.'
          onChange={setFile}
          pickPrompt='Pilih file bukti transfer'
          replacePrompt='Ganti file'
          disabled={isPending}
        />
        <Button type='submit' disabled={!file || isPending} className='w-full min-h-12'>
          {isPending ? 'Mengunggah…' : 'Kirim Bukti Transfer'}
        </Button>
      </form>

      <nav className='flex flex-wrap justify-end gap-3'>
        <Link href='/' className={cn(buttonVariants({ variant: 'outline' }))}>
          Ke beranda
        </Link>
      </nav>
    </main>
  )
}
