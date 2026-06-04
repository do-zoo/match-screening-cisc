'use client'

import { useFormContext } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { formatIdr } from '@/lib/utils/format-idr'
import type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'
import type { SerializedEventForRegistration, SerializedTicketCategory } from '@/components/public/event-serialization'
import type { usePricingPreview } from './use-pricing-preview'
import { buildDisplayHolders, resolveHolderContactDisplay } from './summary-contact-display'
import { useHolderMemberValidation } from './use-holder-member-validation'

type Props = {
  event: SerializedEventForRegistration
  selectedCategory: SerializedTicketCategory | undefined
  pricing: ReturnType<typeof usePricingPreview>
  holders: SubmitRegistrationInput['holders']
  ticketQty: number
  onBack: () => void
  isSubmitting: boolean
}

function memberTypeLabel(h: SubmitRegistrationInput['holders'][number]): string {
  if (h.memberType === 'tangsel') return 'Member Tangsel'
  if (h.memberType === 'regional') return 'Member Regional'
  return 'Non-member'
}

function PrimaryContactRows({
  holder,
  eventId,
}: {
  holder: SubmitRegistrationInput['holders'][number]
  eventId: string
}) {
  const validation = useHolderMemberValidation(
    holder.memberType === 'tangsel' ? holder.claimedMemberNumber : undefined,
    eventId,
  )
  const contact = resolveHolderContactDisplay(holder, validation)

  return (
    <>
      <div className='flex justify-between gap-4'>
        <dt className='text-muted-foreground shrink-0'>Nomor member</dt>
        <dd className='font-mono text-xs text-right'>{contact.memberNumber ?? '—'}</dd>
      </div>
      <div className='flex justify-between gap-4'>
        <dt className='text-muted-foreground shrink-0'>WhatsApp kontak</dt>
        <dd className='font-mono text-xs text-right'>{contact.whatsapp ?? '—'}</dd>
      </div>
      <div className='flex justify-between gap-4'>
        <dt className='text-muted-foreground shrink-0'>Email kontak</dt>
        <dd className='font-mono text-xs text-right break-all'>{contact.email ?? '—'}</dd>
      </div>
    </>
  )
}

export function StepTwo({ event, selectedCategory, pricing, holders, ticketQty, onBack, isSubmitting }: Props) {
  const form = useFormContext<SubmitRegistrationInput>()
  const displayHolders = buildDisplayHolders(holders, ticketQty, event.requireAllHolderData)
  const primaryHolder = holders[0]
  const primaryOnlyMulti = !event.requireAllHolderData && ticketQty > 1
  const unitPrice = pricing?.lines[0]?.ticketPrice ?? 0

  return (
    <div className='space-y-6'>
      {/* Ringkasan peserta */}
      <div className='space-y-4 rounded-xl border border-border bg-card/80 px-5 py-5 shadow-sm'>
        <h2 className='text-xl font-semibold tracking-tight'>Ringkasan Peserta</h2>

        <dl className='space-y-3 text-sm'>
          {selectedCategory && (
            <div className='flex justify-between'>
              <dt className='text-muted-foreground'>Kategori</dt>
              <dd className='font-medium'>{selectedCategory.name}</dd>
            </div>
          )}

          {primaryOnlyMulti ?
            <>
              <div className='flex justify-between'>
                <dt className='text-muted-foreground'>Jumlah tiket</dt>
                <dd className='font-medium'>{ticketQty}</dd>
              </div>

              <div className='space-y-3 rounded-lg border border-border/80 bg-muted/20 px-4 py-4'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary'>
                    Pemesan · Tiket 1
                  </span>
                  {primaryHolder ?
                    <span className='text-xs text-muted-foreground'>({memberTypeLabel(primaryHolder)})</span>
                  : null}
                </div>
                <div className='flex justify-between gap-4'>
                  <dt className='text-muted-foreground shrink-0'>Nama</dt>
                  <dd className='font-medium text-right'>{primaryHolder?.holderName || '—'}</dd>
                </div>
                {primaryHolder ?
                  <PrimaryContactRows holder={primaryHolder} eventId={event.id} />
                : null}
              </div>

              <p className='rounded-lg bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground'>
                {ticketQty === 2 ?
                  'Tiket 2 memakai data pemesan yang sama — tidak perlu diisi ulang.'
                : `Tiket 2–${ticketQty} memakai data pemesan yang sama — tidak perlu diisi ulang.`}
              </p>

              {pricing ?
                <div className='flex justify-between gap-4'>
                  <dt className='text-muted-foreground shrink-0'>Harga per tiket</dt>
                  <dd className='font-mono text-xs tabular-nums text-right'>
                    {formatIdr(unitPrice)} × {ticketQty}
                  </dd>
                </div>
              : null}
            </>
          : <>
              {displayHolders.map((h, i) => (
                <div key={i} className='flex justify-between gap-4'>
                  <dt className='text-muted-foreground shrink-0'>
                    <span className='flex flex-wrap items-center gap-1.5'>
                      Tiket {i + 1} ({memberTypeLabel(h)})
                      {i === 0 ?
                        <span className='rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary'>
                          Pemesan
                        </span>
                      : null}
                    </span>
                  </dt>
                  <dd className='text-right'>
                    <span className='block font-medium'>{h.holderName || '—'}</span>
                    {pricing && (
                      <span className='font-mono text-xs tabular-nums text-muted-foreground'>
                        {formatIdr(pricing.lines[i]?.ticketPrice ?? 0)}
                      </span>
                    )}
                  </dd>
                </div>
              ))}

              {primaryHolder ?
                <PrimaryContactRows holder={primaryHolder} eventId={event.id} />
              : null}
            </>
          }
        </dl>

        {pricing && (
          <div className='flex justify-between border-t pt-3 font-semibold'>
            <span>Total</span>
            <span className='font-mono tabular-nums'>{formatIdr(pricing.grandTotal)}</span>
          </div>
        )}
      </div>

      {/* Info pembayaran */}
      <div className='space-y-3 rounded-xl border border-border bg-card/80 px-5 py-5 shadow-sm'>
        <h2 className='text-xl font-semibold tracking-tight'>Instruksi Pembayaran</h2>
        <p className='text-sm text-muted-foreground'>
          Setelah klik &ldquo;Kirim Pendaftaran&rdquo;, kamu akan diminta upload bukti transfer di halaman berikutnya.
        </p>
        <div className='text-sm leading-relaxed'>
          Transfer ke: <span className='font-medium text-foreground'>{event.bankAccount.bankName}</span> —{' '}
          {event.bankAccount.accountName} <span className='font-mono'>{event.bankAccount.accountNumber}</span>
        </div>
        {pricing && (
          <div className='text-sm'>
            Nominal:{' '}
            <span className='font-mono font-semibold text-foreground tabular-nums'>
              {formatIdr(pricing.grandTotal)}
            </span>
          </div>
        )}
      </div>

      {form.formState.errors.root && (
        <p className='text-sm text-destructive' role='alert'>
          {form.formState.errors.root.message}
        </p>
      )}

      <div className='flex gap-3'>
        <Button type='button' variant='outline' onClick={onBack} disabled={isSubmitting} className='min-h-12'>
          ← Kembali
        </Button>
        <Button type='submit' disabled={isSubmitting} className='min-h-12 flex-1'>
          {isSubmitting ? 'Mengirim…' : 'Kirim Pendaftaran'}
        </Button>
      </div>
    </div>
  )
}
