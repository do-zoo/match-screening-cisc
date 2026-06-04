import Image from 'next/image'
import Link from 'next/link'

import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { formatUploadPurpose } from '@/components/admin/registration-detail-panels/shared/format'
import type { TicketContextVm } from '@/lib/registrations/admin-ticket-context'
import { eventRegistrationDetailPath } from '@/lib/admin/event-registrants-paths'

type Props = {
  eventId: string
  registration: DetailRegistration
  ticketContext: TicketContextVm
}

function uploadLabel(
  upload: DetailRegistration['uploads'][number],
  holders: DetailRegistration['holders'],
): string {
  if (upload.registrationHolderId && upload.purpose === 'member_card_photo') {
    const holder = holders.find(h => h.id === upload.registrationHolderId)
    const name = holder ? holder.holderName : `Holder #${upload.registrationHolderId.slice(-4)}`
    return `Foto kartu member regional — ${name}`
  }
  return formatUploadPurpose(upload.purpose)
}

export function EvidenceSection({ eventId, registration, ticketContext }: Props) {
  return (
    <div className='grid gap-4 md:p-6'>
      <div className='grid gap-2'>
        <h3 className='text-sm font-semibold tracking-tight'>Unggahan</h3>
        {registration.uploads.length === 0 ? (
          <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
            Tidak ada unggahan pada pendaftaran ini.
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
            {registration.uploads.map(upload => (
              <a
                key={upload.id}
                href={upload.blobUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='group overflow-hidden rounded-lg border bg-card'
              >
                <div className='flex items-center justify-between gap-2 border-b px-2 py-1.5 text-xs'>
                  <div className='truncate font-medium'>{uploadLabel(upload, registration.holders)}</div>
                  <div className='shrink-0 font-mono text-[10px] text-muted-foreground'>
                    {Math.round(upload.bytes / 1024)} KB
                  </div>
                </div>
                <div className='relative mx-auto aspect-square w-full max-h-[140px] bg-muted/30 p-2'>
                  <Image
                    src={upload.blobUrl}
                    alt={upload.originalFilename ?? uploadLabel(upload, registration.holders)}
                    fill
                    sizes='(max-width: 640px) 50vw, 33vw'
                    className='object-contain'
                  />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className='grid gap-3 text-sm'>
        <h3 className='text-sm font-semibold tracking-tight'>Konteks tiket & kursi</h3>
        {ticketContext.kind === 'error' ? (
          <p className='text-muted-foreground'>{ticketContext.message}</p>
        ) : (
          <dl className='grid gap-3'>
            <div>
              <dt className='text-muted-foreground'>Bentrok nomor (acara ini)</dt>
              <dd className='mt-1'>
                {ticketContext.conflicts.length === 0 ? (
                  <span className='text-muted-foreground'>
                    Tidak ada registrasi lain dengan nomor member yang sama pada pemegang tiket.
                  </span>
                ) : (
                  <ul className='list-inside list-disc space-y-2'>
                    {ticketContext.conflicts.map(c => (
                      <li key={c.registrationId}>
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
                )}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  )
}
