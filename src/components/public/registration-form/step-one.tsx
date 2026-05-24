'use client'

import { useCallback } from 'react'
import type { FieldArrayWithId } from 'react-hook-form'
import { useFormContext } from 'react-hook-form'

import type { SerializedEventForRegistration } from '@/components/public/event-serialization'
import { Button } from '@/components/ui/button'
import type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'
import { formatIdr } from '@/lib/utils/format-idr'
import type { usePricingPreview } from './use-pricing-preview'

import { CategoryPicker } from './category-picker'
import { HolderCard } from './holder-card'

type Props = {
  event: SerializedEventForRegistration
  fields: FieldArrayWithId<SubmitRegistrationInput, 'holders'>[]
  ticketQty: number
  selectedCategoryId: string
  pricing: ReturnType<typeof usePricingPreview>
  onValidationChange: (index: number, validation: 'valid' | 'invalid' | 'unknown') => void
  onQtyChange: (qty: number) => void
  onNext: () => Promise<void>
}

export function StepOne({
  event,
  fields,
  ticketQty,
  selectedCategoryId,
  pricing,
  onValidationChange,
  onQtyChange,
  onNext,
}: Props) {
  const form = useFormContext<SubmitRegistrationInput>()
  const { setValue } = form

  const handleNext = useCallback(async () => {
    await onNext()
  }, [onNext])

  return (
    <div className='space-y-6'>
      {/* Kategori + jumlah tiket */}
      <div className='space-y-4 rounded-xl border border-border bg-card/80 px-5 py-5 shadow-sm'>
        <h2 className='text-xl font-semibold tracking-tight'>Pilih Tiket</h2>
        {event.ticketCategories && event.ticketCategories.length > 0 ? (
          <CategoryPicker
            categories={event.ticketCategories}
            selectedId={selectedCategoryId}
            onSelect={id => setValue('ticketCategoryId', id)}
            qty={ticketQty}
            onQtyChange={onQtyChange}
          />
        ) : (
          <p className='text-sm text-muted-foreground'>Tidak ada kategori tiket yang tersedia.</p>
        )}
      </div>

      {/* Data peserta */}
      <div className='space-y-4 rounded-xl border border-border bg-card/80 px-5 py-5 shadow-sm'>
        <h2 className='text-xl font-semibold tracking-tight'>Data Peserta</h2>
        <div className='space-y-3'>
          {(event.requireAllHolderData ? fields : fields.slice(0, 1)).map((field, index) => (
            <HolderCard
              key={field.id}
              index={index}
              isPrimary={index === 0}
              menuItems={event.mandatoryMenuItems}
              menuRequired={event.menuRequired ?? false}
              eventId={event.id}
              onValidationChange={onValidationChange}
            />
          ))}
        </div>
      </div>

      {/* Estimasi total */}
      {pricing && (
        <div className='space-y-2 rounded-xl border border-border bg-muted/30 px-5 py-4'>
          <p className='text-sm font-medium'>Estimasi Total</p>
          {pricing.lines.map(l => (
            <div key={l.index} className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>
                Tiket {l.index + 1} ({l.isMember ? 'Member' : 'Reguler'})
              </span>
              <span className='font-mono tabular-nums'>{formatIdr(l.ticketPrice)}</span>
            </div>
          ))}
          <div className='flex justify-between border-t pt-2 font-semibold'>
            <span>Total</span>
            <span className='font-mono tabular-nums'>{formatIdr(pricing.grandTotal)}</span>
          </div>
        </div>
      )}

      {form.formState.errors.root && (
        <p className='text-sm text-destructive' role='alert'>
          {form.formState.errors.root.message}
        </p>
      )}

      <Button type='button' onClick={handleNext} className='w-full min-h-12'>
        Lanjut ke Ringkasan →
      </Button>
    </div>
  )
}
