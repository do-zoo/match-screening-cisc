'use client'

import { useEffect, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { ChevronDown, ChevronUp, Loader2, PencilLine, ShieldCheck, XCircle } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { phoneValueToStoredString, stringToPhoneValue, whatsappDigitsOnly } from '@/lib/forms/phone-value-string'
import type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'
import { contactInitials, maskDisplayName, maskDisplayWhatsapp } from './mask-contact-display'
import {
  useHolderMemberValidation,
  validationToPricing,
  type HolderValidationResult,
} from './use-holder-member-validation'

type Props = {
  index: number
  isPrimary: boolean
  menuItems?: { id: string; name: string; price: number }[]
  menuRequired: boolean
  eventId: string
  onValidationChange: (index: number, pricingValidation: 'valid' | 'invalid' | 'unknown') => void
}

function WhatsAppField({ index }: { index: number }) {
  const form = useFormContext<SubmitRegistrationInput>()
  return (
    <Controller
      control={form.control}
      name={`holders.${index}.holderWhatsapp`}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`holder-${index}-wa`}>Nomor WhatsApp</FieldLabel>
          <PhoneInput
            id={`holder-${index}-wa`}
            name={field.name}
            value={stringToPhoneValue(field.value ?? '')}
            onChange={v => field.onChange(phoneValueToStoredString(v))}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
            placeholder='Nomor WhatsApp peserta'
          />
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

function MemberProfileCard({
  fullName,
  whatsapp,
  onReset,
}: {
  fullName: string
  whatsapp: string | null
  onReset: () => void
}) {
  const hasWhatsapp = !!whatsapp && whatsappDigitsOnly(whatsapp).length >= 8
  return (
    <div className='space-y-2'>
      <div className='relative overflow-hidden rounded-2xl ring-1 ring-primary/20 shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300'>
        <div className='flex flex-row gap-4 rounded-2xl border border-border/80 bg-linear-to-br from-card via-card to-primary/6 px-4 py-4 dark:to-primary/4'>
          <div
            className='flex size-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/80 text-base font-semibold text-primary-foreground shadow-inner'
            aria-hidden
          >
            {contactInitials(fullName)}
          </div>
          <div className='flex min-w-0 flex-1 flex-col gap-2'>
            <span className='flex w-fit items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary'>
              <ShieldCheck className='h-3 w-3' aria-hidden />
              Member terverifikasi
            </span>
            <div className='grid gap-1.5'>
              <div>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Nama</p>
                <p className='text-base font-semibold tracking-tight' aria-hidden>
                  {maskDisplayName(fullName)}
                </p>
              </div>
              <div>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>WhatsApp</p>
                <p className='font-mono text-sm text-muted-foreground' aria-hidden>
                  {hasWhatsapp ? maskDisplayWhatsapp(whatsapp!) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button type='button' variant='outline' size='sm' className='gap-2' onClick={onReset}>
        <PencilLine className='size-4' aria-hidden />
        Ganti nomor member
      </Button>
    </div>
  )
}

function MemberNumberInput({ index, result }: { index: number; result: HolderValidationResult }) {
  const form = useFormContext<SubmitRegistrationInput>()
  return (
    <Controller
      control={form.control}
      name={`holders.${index}.claimedMemberNumber`}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`holder-${index}-member`}>Nomor Member CISC</FieldLabel>
          <div className='relative'>
            <Input
              id={`holder-${index}-member`}
              placeholder='Masukkan nomor member'
              autoComplete='off'
              data-lpignore='true'
              data-form-type='other'
              {...field}
            />
            {result.status === 'checking' && (
              <Loader2 className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground' />
            )}
          </div>
          {result.status === 'not_found' && (
            <span className='flex items-center gap-1 text-xs text-destructive'>
              <XCircle className='h-3 w-3' />
              Nomor tidak terdaftar di direktori
            </span>
          )}
          {result.status === 'already_registered' && (
            <Alert variant='destructive' className='mt-1 text-sm'>
              Member ini sudah mendaftar di acara ini.
            </Alert>
          )}
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export function HolderCard({ index, isPrimary, menuItems, menuRequired, eventId, onValidationChange }: Props) {
  const [expanded, setExpanded] = useState(isPrimary)
  const [isMember, setIsMember] = useState(false)
  const form = useFormContext<SubmitRegistrationInput>()
  const { setValue, watch } = form

  const holderName = watch(`holders.${index}.holderName`)
  const memberNumber = watch(`holders.${index}.claimedMemberNumber`)

  const validationResult = useHolderMemberValidation(isMember ? memberNumber : undefined, eventId)

  // Auto-fill name and WhatsApp from directory when member is verified.
  // Use destructured setValue (stable reference) — not the whole form object, which
  // FormProvider re-creates on every parent render and would cause an infinite loop.
  useEffect(() => {
    if (validationResult.status === 'valid') {
      setValue(`holders.${index}.holderName`, validationResult.fullName, { shouldValidate: true })
      setValue(`holders.${index}.holderWhatsapp`, validationResult.whatsapp ?? '', { shouldValidate: false })
    }
  }, [validationResult, index, setValue])

  // Notify parent of pricing-relevant validation
  useEffect(() => {
    if (!isMember) {
      onValidationChange(index, 'invalid')
      return
    }
    onValidationChange(index, validationToPricing(validationResult))
  }, [isMember, validationResult, index, onValidationChange])

  function handleMemberToggle(value: string) {
    const member = value === 'member'
    setIsMember(member)
    if (!member) {
      setValue(`holders.${index}.claimedMemberNumber`, '')
      setValue(`holders.${index}.holderName`, '')
      setValue(`holders.${index}.holderWhatsapp`, '')
    }
  }

  function handleResetMemberNumber() {
    setValue(`holders.${index}.claimedMemberNumber`, '')
    setValue(`holders.${index}.holderName`, '')
    setValue(`holders.${index}.holderWhatsapp`, '')
  }

  const summaryName = holderName || (memberNumber ? `Member ${memberNumber}` : 'Belum diisi')

  // Whether verified member is missing WhatsApp in the directory
  const memberVerifiedNoWa =
    validationResult.status === 'valid' && whatsappDigitsOnly(validationResult.whatsapp ?? '').length < 8

  return (
    <div className='rounded-lg border'>
      <button
        type='button'
        onClick={() => setExpanded(v => !v)}
        className='flex w-full items-center justify-between px-4 py-3 text-left'
      >
        <span className='font-medium'>
          Tiket {index + 1}
          {isPrimary && ' (Anda)'}
        </span>
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <span className='truncate max-w-36'>{summaryName}</span>
          {expanded ? <ChevronUp className='h-4 w-4 shrink-0' /> : <ChevronDown className='h-4 w-4 shrink-0' />}
        </div>
      </button>

      {expanded && (
        <div className='border-t px-4 pb-4 pt-3 space-y-3'>
          {/* Member / Non-member toggle */}
          <Field>
            <FieldLabel>Status keanggotaan</FieldLabel>
            <RadioGroup
              className='grid grid-cols-2 gap-2'
              value={isMember ? 'member' : 'non'}
              onValueChange={handleMemberToggle}
            >
              <Label
                htmlFor={`holder-${index}-type-non`}
                className={cn(
                  'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5',
                )}
              >
                <RadioGroupItem value='non' id={`holder-${index}-type-non`} />
                <span>Non-Member</span>
              </Label>
              <Label
                htmlFor={`holder-${index}-type-member`}
                className={cn(
                  'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5',
                )}
              >
                <RadioGroupItem value='member' id={`holder-${index}-type-member`} />
                <span>Member CISC</span>
              </Label>
            </RadioGroup>
          </Field>

          {/* Member path */}
          {isMember && validationResult.status === 'valid' && (
            <>
              <MemberProfileCard
                fullName={validationResult.fullName}
                whatsapp={validationResult.whatsapp}
                onReset={handleResetMemberNumber}
              />
              {/* If directory has no WA, let the user fill it in */}
              {memberVerifiedNoWa && (
                <>
                  <Alert variant='destructive' className='text-sm'>
                    Nomor WhatsApp member ini belum terdaftar di direktori. Isi nomor di bawah agar panitia bisa
                    menghubungi peserta.
                  </Alert>
                  <WhatsAppField index={index} />
                </>
              )}
            </>
          )}
          {isMember && validationResult.status !== 'valid' && (
            <MemberNumberInput index={index} result={validationResult} />
          )}

          {/* Non-member path: manual name + WhatsApp */}
          {!isMember && (
            <>
              <Controller
                control={form.control}
                name={`holders.${index}.holderName`}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`holder-${index}-name`}>Nama Lengkap</FieldLabel>
                    <Input id={`holder-${index}-name`} placeholder='Nama sesuai identitas' {...field} />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <WhatsAppField index={index} />
            </>
          )}

          {/* Menu selection */}
          {menuRequired && menuItems && menuItems.length > 0 && (
            <Controller
              control={form.control}
              name={`holders.${index}.mandatoryMenuItemId`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`holder-${index}-menu`}>Pilihan Menu</FieldLabel>
                  <select
                    id={`holder-${index}-menu`}
                    className='block w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || undefined)}
                  >
                    <option value=''>-- Pilih menu --</option>
                    {menuItems.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          )}
        </div>
      )}
    </div>
  )
}
