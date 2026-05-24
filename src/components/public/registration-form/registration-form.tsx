'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormProvider, useFieldArray, useForm, type Resolver } from 'react-hook-form'

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

  const form = useForm<SubmitRegistrationInput>({
    resolver: zodResolver(submitRegistrationSchema as never) as Resolver<SubmitRegistrationInput>,
    defaultValues: {
      ticketCategoryId: event.ticketCategories?.[0]?.id ?? '',
      ticketQty: 1,
      holders: [{ holderName: '', holderWhatsapp: '', claimedMemberNumber: '', mandatoryMenuItemId: '' }],
      contactWhatsapp: '',
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

  const selectedCategoryId = form.watch('ticketCategoryId')
  const ticketQty = form.watch('ticketQty')
  const holders = form.watch('holders')

  const selectedCategory = useMemo(
    () => event.ticketCategories?.find(c => c.id === selectedCategoryId),
    [event.ticketCategories, selectedCategoryId],
  )

  const pricing = usePricingPreview({ category: selectedCategory, holders, holderValidations })

  function handleQtyChange(qty: number) {
    form.setValue('ticketQty', qty)
    if (event.requireAllHolderData) {
      const current = form.getValues('holders')
      const next = Array.from(
        { length: qty },
        (_, i) => current[i] ?? { holderName: '', holderWhatsapp: '', claimedMemberNumber: '', mandatoryMenuItemId: '' },
      )
      replace(next)
      setHolderValidations(prev => Array.from({ length: qty }, (_, i) => prev[i] ?? 'unknown'))
    }
  }

  async function handleNext() {
    form.setValue('holders.0.holderWhatsapp', form.getValues('contactWhatsapp'))
    const valid = await form.trigger()
    if (valid) setStep(2)
  }

  async function onSubmit(values: SubmitRegistrationInput) {
    const holdersToSubmit = values.holders.map((h, i) =>
      i === 0 ? { ...h, holderWhatsapp: values.contactWhatsapp } : h
    )
    const formData = new FormData()
    formData.append('ticketCategoryId', values.ticketCategoryId)
    formData.append('ticketQty', String(values.ticketQty))
    formData.append('holders', JSON.stringify(holdersToSubmit))
    formData.append('contactWhatsapp', values.contactWhatsapp)

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
              onValidationChange={handleValidationChange}
              onQtyChange={handleQtyChange}
              onNext={handleNext}
            />
          )}

          {step === 2 && (
            <StepTwo
              event={event}
              selectedCategory={selectedCategory}
              pricing={pricing}
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
