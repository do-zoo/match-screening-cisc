import type { RegistrationStatus } from '@prisma/client'
import { Badge } from '@/components/ui/badge'

type Props = {
  status: RegistrationStatus
}

export function RegistrationStatusBadge({ status }: Props) {
  const styles: Record<RegistrationStatus, { className: string; label: string }> = {
    submitted: {
      label: 'Terkirim',
      className: 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
    },
    pending_review: {
      label: 'Menunggu tinjauan',
      className: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50',
    },
    payment_issue: {
      label: 'Masalah pembayaran',
      className:
        'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
    },
    approved: {
      label: 'Disetujui',
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
    },
    rejected: {
      label: 'Ditolak',
      className: 'border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-50',
    },
    cancelled: {
      label: 'Dibatalkan',
      className: 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
    },
    refunded: {
      label: 'Refund',
      className: 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
    },
  }

  const s = styles[status]

  return (
    <Badge variant='outline' className={s.className}>
      {s.label}
    </Badge>
  )
}
