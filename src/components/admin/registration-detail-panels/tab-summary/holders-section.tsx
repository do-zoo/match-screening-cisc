import type { MemberType, MemberValidation } from '@prisma/client'

import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { formatCurrencyIdr } from '@/components/admin/registration-detail-panels/shared/format'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Props = {
  registration: DetailRegistration
}

function memberValidationLabel(v: MemberValidation): string {
  if (v === 'valid') return 'Terverifikasi'
  if (v === 'invalid') return 'Ditolak'
  if (v === 'overridden') return 'Dikecualikan'
  return 'Belum diverifikasi'
}

const VALIDATION_BADGE: Record<MemberValidation, string> = {
  valid:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  invalid: 'border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-50',
  overridden:
    'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50',
  unknown:
    'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200',
}

function memberTypeLabel(t: MemberType | null): string {
  if (t === 'tangsel') return 'Tangsel'
  if (t === 'regional') return 'Regional'
  return 'Non-member'
}

const MEMBER_TYPE_BADGE: Record<string, string> = {
  tangsel:
    'border-primary/30 bg-primary/10 text-primary-foreground dark:text-primary-foreground',
  regional: 'border-violet-500/30 bg-violet-500/10 text-violet-950 dark:text-violet-100',
  'non-member': 'border-border bg-muted/40 text-muted-foreground',
}

export function HoldersSection({ registration }: Props) {
  const { holders } = registration

  return (
    <div className='grid gap-4'>
      {/* Mobile: kartu per pemegang */}
      <ul className='grid gap-3 md:hidden'>
        {holders.map(h => {
          const typeKey = h.memberType ?? 'non-member'
          return (
            <li key={h.id} className='rounded-lg border border-border/80 bg-muted/10 p-3'>
              <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                  <p className='font-medium'>
                    #{h.sortOrder} · {h.holderName}
                  </p>
                  <p className='mt-0.5 font-mono text-sm tabular-nums'>{formatCurrencyIdr(h.ticketPriceApplied)}</p>
                </div>
                <Badge variant='outline' className={cn('shrink-0 text-xs', VALIDATION_BADGE[h.memberValidation])}>
                  {memberValidationLabel(h.memberValidation)}
                </Badge>
              </div>
              <dl className='mt-3 grid gap-2 text-sm'>
                <div className='flex justify-between gap-2'>
                  <dt className='text-muted-foreground'>Tipe</dt>
                  <dd>
                    <Badge variant='outline' className={cn('text-xs', MEMBER_TYPE_BADGE[typeKey])}>
                      {memberTypeLabel(h.memberType)}
                    </Badge>
                  </dd>
                </div>
                <div className='flex justify-between gap-2'>
                  <dt className='text-muted-foreground'>No. member</dt>
                  <dd className='font-mono text-xs'>{h.claimedMemberNumber ?? '—'}</dd>
                </div>
                {h.menuItemName ? (
                  <div className='flex justify-between gap-2'>
                    <dt className='text-muted-foreground'>Menu</dt>
                    <dd className='text-right'>{h.menuItemName}</dd>
                  </div>
                ) : null}
              </dl>
            </li>
          )
        })}
      </ul>

      {/* Desktop: tabel */}
      <div className='hidden overflow-x-auto rounded-lg border md:block'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b bg-muted/40'>
              <th className='px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'>#</th>
              <th className='px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'>Nama</th>
              <th className='px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'>Tipe</th>
              <th className='px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'>No. member</th>
              <th className='px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'>Status</th>
              <th className='px-3 py-2.5 text-left text-xs font-medium text-muted-foreground'>Menu</th>
              <th className='px-3 py-2.5 text-right text-xs font-medium text-muted-foreground'>Harga</th>
            </tr>
          </thead>
          <tbody>
            {holders.map(h => {
              const typeKey = h.memberType ?? 'non-member'
              return (
                <tr key={h.id} className='border-t border-border/60'>
                  <td className='px-3 py-2.5 text-muted-foreground tabular-nums'>{h.sortOrder}</td>
                  <td className='px-3 py-2.5 font-medium'>{h.holderName}</td>
                  <td className='px-3 py-2.5'>
                    <Badge variant='outline' className={cn('text-xs', MEMBER_TYPE_BADGE[typeKey])}>
                      {memberTypeLabel(h.memberType)}
                    </Badge>
                  </td>
                  <td className='px-3 py-2.5 font-mono text-xs'>{h.claimedMemberNumber ?? '—'}</td>
                  <td className='px-3 py-2.5'>
                    <Badge variant='outline' className={cn('text-xs', VALIDATION_BADGE[h.memberValidation])}>
                      {memberValidationLabel(h.memberValidation)}
                    </Badge>
                  </td>
                  <td className='px-3 py-2.5 text-muted-foreground'>{h.menuItemName ?? '—'}</td>
                  <td className='px-3 py-2.5 text-right font-mono tabular-nums'>{formatCurrencyIdr(h.ticketPriceApplied)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
