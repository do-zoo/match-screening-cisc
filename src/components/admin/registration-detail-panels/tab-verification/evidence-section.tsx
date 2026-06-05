import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangleIcon, CheckCircle2Icon, ExternalLinkIcon, ImageIcon } from 'lucide-react'

import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { formatUploadPurpose } from '@/components/admin/registration-detail-panels/shared/format'
import type { TicketContextVm } from '@/lib/registrations/admin-ticket-context'
import { eventRegistrationDetailPath } from '@/lib/admin/event-registrants-paths'
import { cn } from '@/lib/utils'

type Props = {
  eventId: string
  registration: DetailRegistration
  ticketContext: TicketContextVm
}

type Upload = DetailRegistration['uploads'][number]

function uploadLabel(upload: Upload, holders: DetailRegistration['holders']): string {
  if (upload.registrationHolderId && upload.purpose === 'member_card_photo') {
    const holder = holders.find(h => h.id === upload.registrationHolderId)
    const name = holder ? holder.holderName : `Holder #${upload.registrationHolderId.slice(-4)}`
    return `Foto kartu member regional — ${name}`
  }
  return formatUploadPurpose(upload.purpose)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}

function UploadPreview({
  upload,
  label,
  variant = 'default',
}: {
  upload: Upload
  label: string
  variant?: 'hero' | 'default'
}) {
  const isHero = variant === 'hero'

  return (
    <a
      href={upload.blobUrl}
      target='_blank'
      rel='noopener noreferrer'
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-muted/20 transition-colors hover:border-primary/40 hover:bg-muted/30',
        isHero ? 'block' : 'flex flex-col',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2',
          isHero ? 'bg-card/80' : 'bg-card/60',
        )}
      >
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium'>{label}</p>
          <p className='text-xs text-muted-foreground'>{formatBytes(upload.bytes)}</p>
        </div>
        <ExternalLinkIcon
          className='size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100'
          aria-hidden
        />
      </div>
      <div
        className={cn(
          'relative bg-muted/10',
          isHero ? 'aspect-4/3 min-h-[220px] w-full sm:min-h-[280px] lg:min-h-[320px]' : 'aspect-square w-full',
        )}
      >
        <Image
          src={upload.blobUrl}
          alt={upload.originalFilename ?? label}
          fill
          sizes={isHero ? '(max-width: 1024px) 100vw, 60vw' : '(max-width: 640px) 50vw, 20vw'}
          className='object-contain p-2 transition-transform duration-200 group-hover:scale-[1.02]'
        />
      </div>
    </a>
  )
}

export function EvidenceSection({ eventId, registration, ticketContext }: Props) {
  const transferProof = registration.uploads.find(u => u.purpose === 'transfer_proof')
  const otherUploads = registration.uploads.filter(u => u.purpose !== 'transfer_proof')
  const hasConflicts = ticketContext.kind !== 'error' && ticketContext.conflicts.length > 0

  return (
    <div className='grid gap-6'>
      <section className='grid gap-3'>
        <div className='flex items-center gap-2'>
          <ImageIcon className='size-4 text-muted-foreground' aria-hidden />
          <h3 className='text-sm font-semibold tracking-tight'>Bukti pendukung</h3>
        </div>

        {registration.uploads.length === 0 ? (
          <div className='flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/10 px-6 py-12 text-center'>
            <ImageIcon className='size-8 text-muted-foreground/60' aria-hidden />
            <p className='text-sm text-muted-foreground'>Tidak ada unggahan pada pendaftaran ini.</p>
          </div>
        ) : (
          <div className='grid gap-3'>
            {transferProof ? (
              <UploadPreview
                upload={transferProof}
                label={uploadLabel(transferProof, registration.holders)}
                variant='hero'
              />
            ) : null}

            {otherUploads.length > 0 ? (
              <div className={cn('grid gap-3', otherUploads.length > 1 ? 'sm:grid-cols-2' : 'max-w-xs')}>
                {otherUploads.map(upload => (
                  <UploadPreview
                    key={upload.id}
                    upload={upload}
                    label={uploadLabel(upload, registration.holders)}
                    variant={transferProof ? 'default' : 'hero'}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className='grid gap-3'>
        <h3 className='text-sm font-semibold tracking-tight'>Konteks tiket & kursi</h3>

        {ticketContext.kind === 'error' ? (
          <div className='rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive'>
            {ticketContext.message}
          </div>
        ) : hasConflicts ? (
          <div className='rounded-xl border border-amber-500/30 bg-amber-500/5 p-4'>
            <div className='flex gap-3'>
              <AlertTriangleIcon className='mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400' aria-hidden />
              <div className='min-w-0 grid gap-2'>
                <p className='text-sm font-medium text-amber-950 dark:text-amber-50'>
                  Bentrok nomor member (acara ini)
                </p>
                <ul className='space-y-2 text-sm'>
                  {ticketContext.conflicts.map(c => (
                    <li key={c.registrationId} className='leading-relaxed'>
                      <span className='text-muted-foreground'>
                        {c.contactName} — {c.memberNumbers.join(', ')} —{' '}
                      </span>
                      <Link
                        href={eventRegistrationDetailPath(eventId, c.registrationId)}
                        className='font-medium underline-offset-4 hover:underline'
                      >
                        buka detail
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className='rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4'>
            <div className='flex gap-3'>
              <CheckCircle2Icon
                className='mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400'
                aria-hidden
              />
              <div>
                <p className='text-sm font-medium text-emerald-950 dark:text-emerald-50'>Tidak ada bentrok</p>
                <p className='mt-1 text-sm leading-relaxed text-muted-foreground'>
                  Tidak ada registrasi lain dengan nomor member yang sama pada pemegang tiket di acara ini.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
