import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatIdr } from '@/lib/utils/format-idr'

type Props = {
  registrationId: string
  eventTitle: string
  totalAmount: number
}

export function PendingReviewPanel({ registrationId, eventTitle, totalAmount }: Props) {
  return (
    <main className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 md:px-6'>
      <header className='flex flex-col gap-2'>
        <h1 className='text-2xl font-semibold tracking-tight'>Menunggu verifikasi panitia</h1>
        <p className='text-sm text-muted-foreground'>
          Bukti transfer kamu sudah kami terima untuk{' '}
          <span className='font-medium text-foreground'>{eventTitle}</span>. Tim akan memverifikasi
          dalam 1&times;24 jam.
        </p>
      </header>

      <section className='grid gap-3 rounded-lg border bg-card p-4 text-sm md:p-6'>
        <div className='flex items-start justify-between gap-4'>
          <dt className='text-muted-foreground'>Nomor pemesanan</dt>
          <dd className='max-w-[60%] break-all font-mono text-right text-xs'>{registrationId}</dd>
        </div>
        <div className='flex items-start justify-between gap-4'>
          <dt className='text-muted-foreground'>Total (snapshot)</dt>
          <dd className='font-mono text-base font-semibold tabular-nums'>{formatIdr(totalAmount)}</dd>
        </div>
        <p className='text-xs text-muted-foreground'>
          Simpan halaman ini sebagai bukti pendaftaran sementara.
        </p>
      </section>

      <nav className='flex flex-wrap justify-end gap-3'>
        <Link href='/' className={cn(buttonVariants({ variant: 'outline' }))}>
          Ke beranda
        </Link>
        <Link href='/events' className={cn(buttonVariants({ variant: 'default' }))}>
          Lihat acara lainnya
        </Link>
      </nav>
    </main>
  )
}
