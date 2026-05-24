import { RegistrationStatus } from '@prisma/client'
import { RegistrationStatusBadge } from '@/components/admin/registration-status-badge'
import { prisma } from '@/lib/db/prisma'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ApprovedPanel } from '@/components/public/registration-form/approved-panel'
import { PendingReviewPanel } from '@/components/public/registration-form/pending-review-panel'
import { UploadProofPanel } from '@/components/public/registration-form/upload-proof-panel'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Status Pendaftaran',
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

  const { status, id, computedTotalAtSubmit, event } = registration

  if (status === RegistrationStatus.submitted) {
    return (
      <UploadProofPanel
        registrationId={id}
        eventTitle={event.title}
        bankName={event.bankAccount.bankName}
        accountName={event.bankAccount.accountName}
        accountNumber={event.bankAccount.accountNumber}
        totalAmount={computedTotalAtSubmit}
      />
    )
  }

  if (status === RegistrationStatus.pending_review) {
    return <PendingReviewPanel registrationId={id} eventTitle={event.title} totalAmount={computedTotalAtSubmit} />
  }

  if (status === RegistrationStatus.approved) {
    return <ApprovedPanel registrationId={id} eventTitle={event.title} totalAmount={computedTotalAtSubmit} />
  }

  // Fallback: rejected, cancelled, refunded, payment_issue, dll
  return (
    <main className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 md:px-6'>
      <header className='flex flex-wrap items-center gap-3'>
        <h1 className='text-2xl font-semibold tracking-tight'>Status Pendaftaran</h1>
        <RegistrationStatusBadge status={status} />
      </header>
      <p className='text-sm text-muted-foreground'>
        Hubungi panitia untuk informasi lebih lanjut mengenai pendaftaran ini.
      </p>
      <p className='break-all font-mono text-xs text-muted-foreground'>{id}</p>
      <nav className='flex flex-wrap justify-end gap-3'>
        <Link href='/' className={cn(buttonVariants({ variant: 'outline' }))}>
          Ke beranda
        </Link>
      </nav>
    </main>
  )
}
