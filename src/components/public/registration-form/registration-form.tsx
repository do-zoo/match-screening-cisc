'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormProvider, useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form'

import { submitRegistration } from '@/lib/actions/submit-registration'
import { toastActionErr } from '@/lib/client/cud-notify'
import { submitRegistrationSchema, type SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'

import { StepIndicator } from './step-indicator'
import { StepOne } from './step-one'
import { StepTwo } from './step-two'
import { usePricingPreview } from './use-pricing-preview'
import type { RegistrationFormProps } from './types'

export function RegistrationForm({ event }: RegistrationFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [memberCardFiles, setMemberCardFiles] = useState<Map<number, File>>(new Map())
  const [missingFileIndices, setMissingFileIndices] = useState<Set<number>>(new Set())

  const form = useForm<SubmitRegistrationInput>({
    resolver: zodResolver(submitRegistrationSchema as never) as Resolver<SubmitRegistrationInput>,
    defaultValues: {
      ticketCategoryId: event.ticketCategories?.[0]?.id ?? '',
      ticketQty: 1,
      holders: [
        { holderName: '', holderWhatsapp: '', holderEmail: '', claimedMemberNumber: '', mandatoryMenuItemId: '' },
      ],
    },
  })

  const { fields, replace } = useFieldArray({ control: form.control, name: 'holders' })

  const [holderValidations, setHolderValidations] = useState<('valid' | 'invalid' | 'unknown')[]>(() =>
    Array(1).fill('unknown'),
  )

  const handleValidationChange = useCallback((index: number, validation: 'valid' | 'invalid' | 'unknown') => {
    setHolderValidations(prev => {
      if (prev[index] === validation) return prev
      const next = [...prev]
      next[index] = validation
      return next
    })
  }, [])

  const handleMemberCardFileChange = useCallback((index: number, file: File | undefined) => {
    setMemberCardFiles(prev => {
      const next = new Map(prev)
      if (file) {
        next.set(index, file)
      } else {
        next.delete(index)
      }
      return next
    })
    if (file) {
      setMissingFileIndices(prev => {
        if (!prev.has(index)) return prev
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
  }, [])

  const selectedCategoryId = useWatch({ control: form.control, name: 'ticketCategoryId' })
  const ticketQty = useWatch({ control: form.control, name: 'ticketQty' })
  const holders = useWatch({ control: form.control, name: 'holders' }) ?? []

  const selectedCategory = useMemo(
    () => event.ticketCategories?.find(c => c.id === selectedCategoryId),
    [event.ticketCategories, selectedCategoryId],
  )

  const pricingHolders = event.requireAllHolderData
    ? holders
    : Array.from(
        { length: ticketQty },
        () =>
          holders[0] ?? {
            holderName: '',
            holderWhatsapp: '',
            holderEmail: '',
            claimedMemberNumber: '',
            mandatoryMenuItemId: '',
          },
      )
  const pricingValidations = event.requireAllHolderData
    ? holderValidations
    : Array.from({ length: ticketQty }, () => holderValidations[0] ?? ('unknown' as const))

  const pricing = usePricingPreview({
    category: selectedCategory,
    holders: pricingHolders,
    holderValidations: pricingValidations,
    forceMemberPricing: event.memberAccessMode !== 'open',
  })

  function handleQtyChange(qty: number) {
    form.setValue('ticketQty', qty)
    if (event.requireAllHolderData) {
      const current = form.getValues('holders')
      const next = Array.from(
        { length: qty },
        (_, i) =>
          current[i] ?? {
            holderName: '',
            holderWhatsapp: '',
            holderEmail: '',
            claimedMemberNumber: '',
            mandatoryMenuItemId: '',
          },
      )
      replace(next)
      setHolderValidations(prev => Array.from({ length: qty }, (_, i) => prev[i] ?? 'unknown'))
    }
  }

  async function handleNext() {
    const valid = await form.trigger()
    if (!valid) return

    const currentHolders = form.getValues('holders')
    const missingIndices = currentHolders
      .map((h, i) => (h.memberType === 'regional' && !memberCardFiles.has(i) ? i : -1))
      .filter(i => i !== -1)
    if (missingIndices.length > 0) {
      setMissingFileIndices(new Set(missingIndices))
      form.setError('root', {
        message: 'Upload bukti kartu member untuk semua peserta Member CISC Regional sebelum melanjutkan.',
      })
      return
    }

    setMissingFileIndices(new Set())
    form.clearErrors('root')
    setStep(2)
  }

  async function onSubmit(values: SubmitRegistrationInput) {
    // Validate regional files again at submit (defensive)
    const missingFile = values.holders.some((h, i) => h.memberType === 'regional' && !memberCardFiles.has(i))
    if (missingFile) {
      form.setError('root', {
        message: 'Upload bukti kartu member untuk semua peserta Member CISC Regional.',
      })
      return
    }

    const formData = new FormData()
    formData.append('ticketCategoryId', values.ticketCategoryId)
    formData.append('ticketQty', String(values.ticketQty))
    formData.append('holders', JSON.stringify(values.holders))

    // Append member card photos for regional holders
    memberCardFiles.forEach((file, index) => {
      formData.append(`memberCardPhoto_${index}`, file)
    })

    const result = await submitRegistration(event.id, formData)
    if (result.ok) {
      router.push(`/events/${event.slug}/register/${result.data.registrationId}`)
      return
    }

    toastActionErr(result)
    if (result.rootError) form.setError('root', { message: result.rootError })
  }

  return (
    <FormProvider {...form}>
      <form className='mx-auto flex w-full max-w-2xl flex-col gap-6' onSubmit={form.handleSubmit(onSubmit)}>
        <StepIndicator current={step} />

        <fieldset
          disabled={!event.registrationOpen || form.formState.isSubmitting}
          className='min-w-0 space-y-6 border-0 p-0'
        >
          <legend className='sr-only'>Formulir pendaftaran acara</legend>

          {step === 1 && (
            <StepOne
              event={event}
              fields={fields}
              ticketQty={ticketQty}
              selectedCategoryId={selectedCategoryId}
              pricing={pricing}
              missingFileIndices={missingFileIndices}
              onValidationChange={handleValidationChange}
              onMemberCardFileChange={handleMemberCardFileChange}
              onQtyChange={handleQtyChange}
              onNext={handleNext}
            />
          )}

          {step === 2 && (
            <StepTwo
              event={event}
              selectedCategory={selectedCategory}
              pricing={pricing}
              holders={holders}
              ticketQty={ticketQty}
              onBack={() => setStep(1)}
              isSubmitting={form.formState.isSubmitting}
            />
          )}
        </fieldset>
      </form>
    </FormProvider>
  )
}

export default RegistrationForm
