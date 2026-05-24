'use client'

import { useFormContext } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { formatIdr } from '@/lib/utils/format-idr'
import type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'
import type { SerializedEventForRegistration, SerializedTicketCategory } from '@/components/public/event-serialization'
import type { usePricingPreview } from './use-pricing-preview'

type Props = {
  event: SerializedEventForRegistration
  selectedCategory: SerializedTicketCategory | undefined
  pricing: ReturnType<typeof usePricingPreview>
  onBack: () => void
  isSubmitting: boolean
}

export function StepTwo({ event, selectedCategory, pricing, onBack, isSubmitting }: Props) {
  const form = useFormContext<SubmitRegistrationInput>()
  const holders = form.watch('holders')

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

          {holders.map((h, i) => (
            <div key={i} className='flex justify-between'>
              <dt className='text-muted-foreground'>
                Tiket {i + 1}
                {h.claimedMemberNumber ? ' (Member)' : ' (Non-member)'}
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

          <div className='flex justify-between'>
            <dt className='text-muted-foreground'>WhatsApp kontak</dt>
            <dd className='font-mono text-xs'>{holders[0]?.holderWhatsapp || '—'}</dd>
          </div>
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
