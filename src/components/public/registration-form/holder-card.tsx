'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { ChevronDown, ChevronUp, Loader2, PencilLine, ShieldCheck, Utensils, XCircle } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { FileField } from '@/components/ui/file-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import type { MemberAccessMode } from '@prisma/client'
import type { SerializedEventMenuItem } from '@/components/public/event-serialization'
import { allowedMemberTypesForMode } from '@/lib/events/member-access-mode'
import { phoneValueToStoredString, stringToPhoneValue, whatsappDigitsOnly } from '@/lib/forms/phone-value-string'
import type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'
import { contactInitials, maskDisplayName, maskDisplayWhatsapp } from './mask-contact-display'
import {
  useHolderMemberValidation,
  validationToPricing,
  type HolderValidationResult,
} from './use-holder-member-validation'

type MemberType = 'non' | 'tangsel' | 'regional'

type Props = {
  index: number
  isPrimary: boolean
  menuItems?: SerializedEventMenuItem[]
  menuRequired: boolean
  eventId: string
  memberAccessMode?: MemberAccessMode
  showFileRequired?: boolean
  onValidationChange: (index: number, pricingValidation: 'valid' | 'invalid' | 'unknown') => void
  onMemberCardFileChange: (index: number, file: File | undefined) => void
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

function HolderEmailField({ index, isPrimary }: { index: number; isPrimary: boolean }) {
  const form = useFormContext<SubmitRegistrationInput>()
  return (
    <Controller
      control={form.control}
      name={`holders.${index}.holderEmail`}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`holder-${index}-email`}>
            {isPrimary ? 'Email kontak' : 'Email (opsional)'}
          </FieldLabel>
          <Input
            id={`holder-${index}-email`}
            type='email'
            name={field.name}
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
            placeholder='nama@contoh.com'
            autoComplete='email'
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
          <FieldLabel htmlFor={`holder-${index}-member`}>Nomor Member CISC Tangsel</FieldLabel>
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

function RegionalMemberForm({
  index,
  onMemberCardFileChange,
  showFileRequired,
}: {
  index: number
  onMemberCardFileChange: (index: number, file: File | undefined) => void
  showFileRequired: boolean
}) {
  const form = useFormContext<SubmitRegistrationInput>()

  return (
    <div className='space-y-3'>
      <Alert className='text-sm'>
        Isi data keanggotaanmu dan upload bukti kartu member. Panitia akan memverifikasi setelah pendaftaran masuk.
      </Alert>

      <Controller
        control={form.control}
        name={`holders.${index}.claimedMemberNumber`}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`holder-${index}-regional-member`}>Nomor Member</FieldLabel>
            <Input
              id={`holder-${index}-regional-member`}
              placeholder='Nomor member dari chapter regional'
              autoComplete='off'
              data-lpignore='true'
              data-form-type='other'
              {...field}
            />
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        control={form.control}
        name={`holders.${index}.holderName`}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`holder-${index}-regional-name`}>Nama Lengkap</FieldLabel>
            <Input id={`holder-${index}-regional-name`} placeholder='Nama sesuai identitas' {...field} />
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <WhatsAppField index={index} />

      <FileField
        id={`holder-${index}-member-card`}
        label='Bukti Kartu Member'
        description='Upload foto atau screenshot member ID dari panel chelseaindo'
        onChange={file => onMemberCardFileChange(index, file)}
        pickPrompt='Pilih foto bukti member'
        replacePrompt='Ganti foto'
        invalid={showFileRequired}
        errors={showFileRequired ? [{ message: 'Bukti kartu member wajib diupload' }] : undefined}
        maxSizeBytes={8 * 1024 * 1024}
      />
    </div>
  )
}

export function HolderCard({
  index,
  isPrimary,
  menuItems,
  menuRequired,
  eventId,
  memberAccessMode = 'open',
  showFileRequired = false,
  onValidationChange,
  onMemberCardFileChange,
}: Props) {
  const [expanded, setExpanded] = useState(isPrimary)
  const [memberType, setMemberType] = useState<MemberType>(() =>
    memberAccessMode === 'tangsel_only' ? 'tangsel' : 'non',
  )
  const form = useFormContext<SubmitRegistrationInput>()
  const { setValue } = form

  const holderName = form.watch(`holders.${index}.holderName`)
  const memberNumber = form.watch(`holders.${index}.claimedMemberNumber`)

  const allowedTypes = allowedMemberTypesForMode(memberAccessMode)
  const showNonMember = allowedTypes === 'all'
  const showTangsel = allowedTypes === 'all' || allowedTypes.includes('tangsel')
  const showRegional = allowedTypes === 'all' || allowedTypes.includes('regional')
  const visibleTypeCount = [showNonMember, showTangsel, showRegional].filter(Boolean).length

  useEffect(() => {
    if (memberAccessMode !== 'tangsel_only') return
    queueMicrotask(() => {
      setMemberType('tangsel')
      setValue(`holders.${index}.memberType`, 'tangsel')
    })
  }, [memberAccessMode, index, setValue])

  const validationResult = useHolderMemberValidation(memberType === 'tangsel' ? memberNumber : undefined, eventId)

  // Auto-fill name and WhatsApp from directory when Tangsel member is verified.
  useEffect(() => {
    if (memberType !== 'tangsel' || validationResult.status !== 'valid') return
    const { fullName, whatsapp, email } = validationResult
    queueMicrotask(() => {
      setValue(`holders.${index}.holderName`, fullName, { shouldValidate: true })
      setValue(`holders.${index}.holderWhatsapp`, whatsapp ?? '', { shouldValidate: false })
      if (email) {
        setValue(`holders.${index}.holderEmail`, email, { shouldValidate: true })
      }
    })
  }, [memberType, validationResult, index, setValue])

  // Notify parent of pricing-relevant validation.
  useEffect(() => {
    if (memberType === 'non') {
      onValidationChange(index, 'invalid')
    } else if (memberType === 'regional') {
      onValidationChange(index, 'valid')
    } else {
      onValidationChange(index, validationToPricing(validationResult))
    }
  }, [memberType, validationResult, index, onValidationChange])

  function handleMemberToggle(value: string) {
    const next = value as MemberType
    setMemberType(next)
    setValue(`holders.${index}.memberType`, next === 'non' ? undefined : (next as 'tangsel' | 'regional'))
    if (next !== 'tangsel') {
      setValue(`holders.${index}.claimedMemberNumber`, '')
      if (next !== 'regional') {
        setValue(`holders.${index}.holderName`, '')
        setValue(`holders.${index}.holderWhatsapp`, '')
        setValue(`holders.${index}.holderEmail`, '')
      }
    }
    if (next !== 'regional') {
      onMemberCardFileChange(index, undefined)
    }
  }

  function handleResetMemberNumber() {
    setValue(`holders.${index}.claimedMemberNumber`, '')
    setValue(`holders.${index}.holderName`, '')
    setValue(`holders.${index}.holderWhatsapp`, '')
    setValue(`holders.${index}.holderEmail`, '')
  }

  // Whether verified Tangsel member is missing WhatsApp in the directory
  const memberVerifiedNoWa =
    memberType === 'tangsel' &&
    validationResult.status === 'valid' &&
    whatsappDigitsOnly(validationResult.whatsapp ?? '').length < 8

  const summaryName = holderName || (memberNumber ? `Member ${memberNumber}` : 'Belum diisi')

  return (
    <div className={cn('rounded-lg border', isPrimary && 'border-primary bg-primary/5')}>
      <button
        type='button'
        onClick={() => setExpanded(v => !v)}
        className='flex w-full items-center justify-between px-4 py-3 text-left'
      >
        <span className='flex items-center gap-2 font-medium'>
          Tiket {index + 1}
          {isPrimary && (
            <span className='rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary'>Pemesan</span>
          )}
        </span>
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <span className='truncate max-w-36'>{summaryName}</span>
          {expanded ? <ChevronUp className='h-4 w-4 shrink-0' /> : <ChevronDown className='h-4 w-4 shrink-0' />}
        </div>
      </button>

      {expanded && (
        <div className='border-t px-4 pb-4 pt-3 space-y-3'>
          {/* Member type radio group */}
          <Field>
            <FieldLabel>Status keanggotaan</FieldLabel>
            <RadioGroup
              className={cn(
                'grid gap-2',
                visibleTypeCount === 1 ? 'grid-cols-1' : visibleTypeCount === 2 ? 'grid-cols-2' : 'grid-cols-3',
              )}
              value={memberType}
              onValueChange={handleMemberToggle}
            >
              {showNonMember ? (
                <Label
                  htmlFor={`holder-${index}-type-non`}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5',
                  )}
                >
                  <RadioGroupItem value='non' id={`holder-${index}-type-non`} />
                  <span>Non-Member</span>
                </Label>
              ) : null}
              {showTangsel ? (
                <Label
                  htmlFor={`holder-${index}-type-tangsel`}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5',
                  )}
                >
                  <RadioGroupItem value='tangsel' id={`holder-${index}-type-tangsel`} />
                  <span>Member CISC Regional Tangsel</span>
                </Label>
              ) : null}
              {showRegional ? (
                <Label
                  htmlFor={`holder-${index}-type-regional`}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5',
                  )}
                >
                  <RadioGroupItem value='regional' id={`holder-${index}-type-regional`} />
                  <span>Member CISC Regional Lainnya</span>
                </Label>
              ) : null}
            </RadioGroup>
          </Field>

          {/* Tangsel member path */}
          {memberType === 'tangsel' && validationResult.status === 'valid' && (
            <>
              <MemberProfileCard
                fullName={validationResult.fullName}
                whatsapp={validationResult.whatsapp}
                onReset={handleResetMemberNumber}
              />
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
          {memberType === 'tangsel' && validationResult.status !== 'valid' && (
            <>
              <MemberNumberInput index={index} result={validationResult} />
              {form.formState.errors.holders?.[index]?.holderName && (
                <p className='text-sm text-destructive'>
                  Masukkan nomor member CISC Tangsel yang valid untuk melanjutkan.
                </p>
              )}
            </>
          )}

          {/* Regional member path */}
          {memberType === 'regional' && (
            <RegionalMemberForm
              index={index}
              onMemberCardFileChange={onMemberCardFileChange}
              showFileRequired={showFileRequired}
            />
          )}

          {/* Non-member path */}
          {memberType === 'non' && (
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

          <HolderEmailField index={index} isPrimary={isPrimary} />

          {/* Menu selection */}
          {menuRequired && menuItems && menuItems.length > 0 && (
            <Controller
              control={form.control}
              name={`holders.${index}.mandatoryMenuItemId`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Pilihan Menu</FieldLabel>
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {menuItems.map(m => (
                      <label
                        key={m.id}
                        className={cn(
                          'relative flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-colors',
                          field.value === m.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50',
                        )}
                      >
                        {/* Gambar */}
                        <div className='relative h-28 w-full shrink-0 bg-muted'>
                          {m.imageBlobUrl ? (
                            <Image
                              src={m.imageBlobUrl}
                              alt={m.name}
                              fill
                              className='object-cover'
                              sizes='(max-width: 640px) 100vw, 50vw'
                            />
                          ) : (
                            <div className='flex h-full items-center justify-center'>
                              <Utensils className='h-8 w-8 text-muted-foreground/40' />
                            </div>
                          )}
                        </div>
                        {/* Radio absolute */}
                        <input
                          type='radio'
                          name={`holder-${index}-menu`}
                          value={m.id}
                          checked={field.value === m.id}
                          onChange={() => field.onChange(m.id)}
                          className='absolute top-2 right-2'
                        />
                        {/* Konten */}
                        <div className='p-3'>
                          <p className='text-sm font-medium leading-snug'>{m.name}</p>
                          {m.description && (
                            <p className='mt-0.5 text-xs text-muted-foreground leading-relaxed'>{m.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
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
