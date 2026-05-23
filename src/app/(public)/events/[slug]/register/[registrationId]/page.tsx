import { RegistrationStatusBadge } from '@/components/admin/registration-status-badge'
import { buttonVariants } from '@/components/ui/button'
import { prisma } from '@/lib/db/prisma'
import { cn } from '@/lib/utils'
import { formatIdr } from '@/lib/utils/format-idr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Pendaftaran Diterima',
  robots: { index: false, follow: false },
}

export default async function RegistrationReceiptPage({
  params,
}: {
  params: Promise<{ slug: string; registrationId: string }>
}) {
  const { slug, registrationId } = await params

  const registration = await prisma.registration.findFirst({
    where: {
      id: registrationId,
      event: { slug },
    },
    include: {
      event: {
        include: { bankAccount: true },
      },
    },
  })

  if (!registration) notFound()

  return (
    <main className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 md:px-6 py-12'>
      <header className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-center gap-3'>
          <h1 className='font-semibold text-2xl tracking-tight'>Pendaftaran diterima</h1>
          <RegistrationStatusBadge status={registration.status} />
        </div>
        <p className='text-sm text-[hsl(var(--muted-foreground))]'>
          Simpan halaman ini sebagai bukti pemesanan sementara. Tim akan memverifikasi pembayaran dan status kamu akan
          di-update.
        </p>
      </header>

      <section className='grid gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-6'>
        <div className='text-sm font-medium'>Ringkas</div>
        <dl className='grid gap-3 text-sm'>
          <div className='flex items-start justify-between gap-4 md:p-6'>
            <dt className='text-[hsl(var(--muted-foreground))]'>Acara</dt>
            <dd className='text-right'>{registration.event.title}</dd>
          </div>

          <div className='flex items-start justify-between gap-4 md:p-6'>
            <dt className='text-[hsl(var(--muted-foreground))]'>Nomor pemesanan</dt>
            <dd className='max-w-[60%] break-all font-mono text-right text-xs'>{registration.id}</dd>
          </div>

          <div className='flex items-start justify-between gap-4 md:p-6'>
            <dt className='text-[hsl(var(--muted-foreground))]'>Total (snapshot)</dt>
            <dd className='font-mono text-base font-semibold'>{formatIdr(registration.computedTotalAtSubmit)}</dd>
          </div>
        </dl>
      </section>

      <nav className='flex flex-wrap gap-3 justify-end' aria-label='Navigasi setelah pendaftaran'>
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
