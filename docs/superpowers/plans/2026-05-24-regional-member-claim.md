# Regional Member Claim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "Member CISC regional lainnya" radio option to holder cards so non-Tangsel CISC members can register with manual data entry and upload proof of membership for admin verification.

**Architecture:** Three layers change in concert: (1) Prisma schema adds `MemberType` enum to `RegistrationHolder` and `registrationHolderId` FK to `Upload`; (2) the public registration form gains a third radio with manual fields + file upload wired into `FormData`; (3) `submitRegistration` server action uploads the proof photo per-holder after creating the registration row, non-fatally.

**Tech Stack:** Prisma ORM (neon adapter), Next.js Server Actions, React Hook Form + Zod, Vercel Blob via `uploadImageForRegistration`, Vitest for unit tests.

---

## File Map

| Status | Path | Responsibility |
|---|---|---|
| Modify | `prisma/schema.prisma` | Add `MemberType` enum, `RegistrationHolder.memberType`, `RegistrationHolder.uploads`, `Upload.registrationHolderId` |
| Modify | `src/lib/uploads/save-upload.ts` | Accept optional `registrationHolderId` |
| Modify | `src/lib/uploads/upload-image.ts` | Accept and forward optional `registrationHolderId` |
| Create | `src/lib/forms/submit-registration-schema.test.ts` | Unit test for `memberType` field shape |
| Modify | `src/lib/forms/submit-registration-schema.ts` | Add `memberType` to `holderSchema` |
| Modify | `src/lib/actions/submit-registration.ts` | Parse regional files, save `memberType`, upload per-holder |
| Modify | `src/components/public/registration-form/holder-card.tsx` | 3 radios + `RegionalMemberForm`, `onMemberCardFileChange` prop |
| Modify | `src/components/public/registration-form/step-one.tsx` | Thread `onMemberCardFileChange` to `HolderCard` |
| Modify | `src/components/public/registration-form/registration-form.tsx` | `memberCardFiles` state, file validation in `handleNext`, append to `FormData` |
| Modify | `src/components/public/registration-form/step-two.tsx` | Update summary label for member type |
| Modify | `src/components/admin/registration-detail-panels/shared/registration-detail-types.ts` | Add `memberType` to holder, `registrationHolderId` to upload |
| Modify | `src/app/admin/events/[eventId]/registrants/[registrationId]/page.tsx` | Select + map `memberType`, `registrationHolderId` |
| Modify | `src/components/admin/registration-detail-panels/tab-summary/holders-section.tsx` | Add Tipe Member column |
| Modify | `src/components/admin/registration-detail-panels/tab-verification/evidence-section.tsx` | Label regional member card photos by holder |

---

## Task 1: Prisma schema — MemberType enum + new fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `MemberType` enum and new fields to schema**

In `prisma/schema.prisma`, add the enum directly after the `MemberValidation` enum block (around line 39), then add two fields to `RegistrationHolder`, and two fields + relation to `Upload`.

Add after `enum MemberValidation { ... }`:
```prisma
enum MemberType {
  tangsel
  regional
}
```

In `model RegistrationHolder`, add after `mandatoryMenuPriceApplied Int?`:
```prisma
  memberType                MemberType?
  uploads                   Upload[]
```

In `model Upload`, add after the `invoiceAdjustment` relation field:
```prisma
  registrationHolderId String?
  registrationHolder   RegistrationHolder? @relation(fields: [registrationHolderId], references: [id], onDelete: Cascade)
```

- [ ] **Step 2: Run migration**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm db:migrate:dev
```

When prompted for migration name, enter: `add_member_type_and_holder_upload_link`

Expected: migration files created under `prisma/migrations/`, Prisma Client regenerated without error.

- [ ] **Step 3: Verify Prisma Client generated correctly**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && node -e "
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
console.log('MemberType enum:', p._dmmf?.datamodel?.enums?.find(e => e.name === 'MemberType')?.values?.map(v => v.name))
p.\$disconnect()
"
```

Expected output: `MemberType enum: [ 'tangsel', 'regional' ]`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add MemberType enum and holder upload link"
```

---

## Task 2: Extend upload infrastructure

**Files:**
- Modify: `src/lib/uploads/save-upload.ts`
- Modify: `src/lib/uploads/upload-image.ts`

- [ ] **Step 1: Update `saveUploadMetadata` to accept `registrationHolderId`**

In `src/lib/uploads/save-upload.ts`, change the function to:

```ts
import type { UploadPurpose } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export async function saveUploadMetadata(input: {
  purpose: UploadPurpose
  blobUrl: string
  blobPath: string
  contentType: string
  bytes: number
  sha256: string
  width?: number
  height?: number
  originalFilename?: string
  registrationId?: string
  invoiceAdjustmentId?: string
  registrationHolderId?: string
}) {
  return prisma.upload.create({
    data: {
      purpose: input.purpose,
      blobUrl: input.blobUrl,
      blobPath: input.blobPath,
      contentType: input.contentType,
      bytes: input.bytes,
      sha256: input.sha256,
      width: input.width,
      height: input.height,
      originalFilename: input.originalFilename,
      registrationId: input.registrationId,
      invoiceAdjustmentId: input.invoiceAdjustmentId,
      registrationHolderId: input.registrationHolderId,
    },
  })
}
```

- [ ] **Step 2: Update `uploadImageForRegistration` to accept `registrationHolderId`**

In `src/lib/uploads/upload-image.ts`, update the input type and forward the field:

```ts
import type { UploadPurpose } from '@prisma/client'
import { del } from '@vercel/blob'
import { retry } from '@/lib/uploads/retry'
import { toWebp } from '@/lib/uploads/images'
import { putWebpToBlob } from '@/lib/uploads/blob'
import { saveUploadMetadata } from '@/lib/uploads/save-upload'
import { UploadError } from '@/lib/uploads/errors'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export async function uploadImageForRegistration(input: {
  purpose: Extract<UploadPurpose, 'transfer_proof' | 'member_card_photo' | 'partner_member_card_photo'>
  registrationId: string
  file: File
  registrationHolderId?: string
}): Promise<{ uploadId: string; url: string }> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(input.file.type)) {
    throw new UploadError('File must be an image.', {
      code: 'invalid_content_type',
      recoverable: true,
    })
  }

  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError('File is too large.', {
      code: 'file_too_large',
      recoverable: true,
    })
  }

  const raw = Buffer.from(await input.file.arrayBuffer())
  const webp = await toWebp(raw, { maxDim: 1600, quality: 80 })

  // When linked to a specific holder, use a holder-scoped path to avoid blob collisions
  // when multiple holders in the same registration are all regional members.
  const blobPath = input.registrationHolderId
    ? `registrations/${input.registrationId}/holders/${input.registrationHolderId.slice(-8)}/${input.purpose}.webp`
    : `registrations/${input.registrationId}/${input.purpose}.webp`
  const putRes = await retry(() => putWebpToBlob({ path: blobPath, bytes: webp.bytes }), {
    maxAttempts: 3,
    delayMs: 250,
  })

  let row
  try {
    row = await saveUploadMetadata({
      purpose: input.purpose,
      registrationId: input.registrationId,
      registrationHolderId: input.registrationHolderId,
      blobUrl: putRes.url,
      blobPath: putRes.pathname,
      contentType: 'image/webp',
      bytes: webp.bytes.length,
      sha256: webp.sha256,
      width: webp.width,
      height: webp.height,
      originalFilename: input.file.name,
    })
  } catch (err) {
    try {
      await del(putRes.url)
    } catch {
      // best-effort cleanup
    }
    throw err
  }

  return { uploadId: row.id, url: row.blobUrl }
}
```

- [ ] **Step 3: Build check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors on these two files. (Full build may fail on other tasks not yet done — that's fine.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/uploads/save-upload.ts src/lib/uploads/upload-image.ts
git commit -m "feat(uploads): add registrationHolderId support to upload infrastructure"
```

---

## Task 3: Form schema — add `memberType` field

**Files:**
- Create: `src/lib/forms/submit-registration-schema.test.ts`
- Modify: `src/lib/forms/submit-registration-schema.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/forms/submit-registration-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { holderSchema } from './submit-registration-schema'

describe('holderSchema.memberType', () => {
  const field = holderSchema.shape.memberType

  it('accepts tangsel', () => {
    expect(field.safeParse('tangsel').success).toBe(true)
  })

  it('accepts regional', () => {
    expect(field.safeParse('regional').success).toBe(true)
  })

  it('accepts undefined (non-member)', () => {
    expect(field.safeParse(undefined).success).toBe(true)
  })

  it('rejects any other string', () => {
    expect(field.safeParse('cisc').success).toBe(false)
    expect(field.safeParse('member').success).toBe(false)
    expect(field.safeParse('').success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/forms/submit-registration-schema.test.ts
```

Expected: FAIL — `holderSchema.shape.memberType` is `undefined` (field does not exist yet).

- [ ] **Step 3: Add `memberType` to `holderSchema`**

In `src/lib/forms/submit-registration-schema.ts`, update `holderSchema`:

```ts
import { isValidPhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'
import { toE164PlusForValidation } from '@/lib/forms/phone-value-string'

export const whatsappPhoneSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    const e164 = toE164PlusForValidation(val)
    if (!e164) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'WhatsApp wajib diisi' })
      return
    }
    if (!isValidPhoneNumber(e164)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nomor WhatsApp tidak valid' })
    }
  })

export const holderSchema = z.object({
  holderName: z.string().trim().min(1, 'Nama pemegang tiket wajib diisi'),
  holderWhatsapp: whatsappPhoneSchema,
  claimedMemberNumber: z.string().trim().optional(),
  mandatoryMenuItemId: z.string().optional(),
  memberType: z.enum(['tangsel', 'regional']).optional(),
})

export type HolderInput = z.infer<typeof holderSchema>

export const submitRegistrationSchema = z.object({
  ticketCategoryId: z.string().min(1, 'Pilih kategori tiket'),
  ticketQty: z.number().int().min(1, 'Jumlah tiket minimal 1'),
  holders: z.array(holderSchema).min(1, 'Minimal satu pemegang tiket'),
})

export type SubmitRegistrationInput = z.infer<typeof submitRegistrationSchema>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/forms/submit-registration-schema.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forms/submit-registration-schema.ts src/lib/forms/submit-registration-schema.test.ts
git commit -m "feat(schema): add memberType field to holderSchema"
```

---

## Task 4: Holder card — three radios + regional form

**Files:**
- Modify: `src/components/public/registration-form/holder-card.tsx`

This is a UI-only change. No automated tests — verify by running `pnpm dev` and checking the form manually.

- [ ] **Step 1: Replace holder-card.tsx with updated version**

Replace the entire contents of `src/components/public/registration-form/holder-card.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { ChevronDown, ChevronUp, Loader2, PencilLine, ShieldCheck, XCircle } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { FileField } from '@/components/ui/file-field'
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

type MemberType = 'non' | 'tangsel' | 'regional'

type Props = {
  index: number
  isPrimary: boolean
  menuItems?: { id: string; name: string; price: number }[]
  menuRequired: boolean
  eventId: string
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
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor={`holder-${index}-regional-member`}>
              Nomor Member{' '}
              <span className='text-xs font-normal text-muted-foreground'>(opsional)</span>
            </FieldLabel>
            <Input
              id={`holder-${index}-regional-member`}
              placeholder='Nomor member dari chapter regional'
              autoComplete='off'
              data-lpignore='true'
              data-form-type='other'
              {...field}
            />
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
  onValidationChange,
  onMemberCardFileChange,
}: Props) {
  const [expanded, setExpanded] = useState(isPrimary)
  const [memberType, setMemberType] = useState<MemberType>('non')
  const [showFileRequired, setShowFileRequired] = useState(false)
  const form = useFormContext<SubmitRegistrationInput>()
  const { setValue } = form

  const holderName = form.watch(`holders.${index}.holderName`)
  const memberNumber = form.watch(`holders.${index}.claimedMemberNumber`)

  const validationResult = useHolderMemberValidation(memberType === 'tangsel' ? memberNumber : undefined, eventId)

  // Auto-fill name and WhatsApp from directory when Tangsel member is verified.
  useEffect(() => {
    if (memberType === 'tangsel' && validationResult.status === 'valid') {
      setValue(`holders.${index}.holderName`, validationResult.fullName, { shouldValidate: true })
      setValue(`holders.${index}.holderWhatsapp`, validationResult.whatsapp ?? '', { shouldValidate: false })
    }
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
    setShowFileRequired(false)
    setValue(`holders.${index}.memberType`, next === 'non' ? undefined : (next as 'tangsel' | 'regional'))
    if (next !== 'tangsel') {
      setValue(`holders.${index}.claimedMemberNumber`, '')
      if (next !== 'regional') {
        setValue(`holders.${index}.holderName`, '')
        setValue(`holders.${index}.holderWhatsapp`, '')
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
            <span className='rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary'>
              Pemesan
            </span>
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
              className='grid grid-cols-3 gap-2'
              value={memberType}
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
                htmlFor={`holder-${index}-type-tangsel`}
                className={cn(
                  'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5',
                )}
              >
                <RadioGroupItem value='tangsel' id={`holder-${index}-type-tangsel`} />
                <span>Member CISC Tangsel</span>
              </Label>
              <Label
                htmlFor={`holder-${index}-type-regional`}
                className={cn(
                  'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5',
                )}
              >
                <RadioGroupItem value='regional' id={`holder-${index}-type-regional`} />
                <span>Member CISC Regional</span>
              </Label>
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
            <MemberNumberInput index={index} result={validationResult} />
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/public/registration-form/holder-card.tsx
git commit -m "feat(public): add Member CISC Regional radio option to holder card"
```

---

## Task 5: Wire member card files through registration form

**Files:**
- Modify: `src/components/public/registration-form/step-one.tsx`
- Modify: `src/components/public/registration-form/registration-form.tsx`
- Modify: `src/components/public/registration-form/step-two.tsx`

- [ ] **Step 1: Add `onMemberCardFileChange` prop to `StepOne`**

In `src/components/public/registration-form/step-one.tsx`, update the `Props` type and pass the prop to `HolderCard`:

```tsx
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
  onMemberCardFileChange: (index: number, file: File | undefined) => void
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
  onMemberCardFileChange,
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
              onMemberCardFileChange={onMemberCardFileChange}
            />
          ))}
          {!event.requireAllHolderData && ticketQty > 1 && (
            <p className='rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground'>
              {ticketQty === 2 ? 'Tiket 2' : `Tiket 2–${ticketQty}`} tidak memerlukan data peserta untuk acara ini.
            </p>
          )}
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
```

- [ ] **Step 2: Update `RegistrationForm` — add `memberCardFiles` state and wiring**

Replace the entire contents of `src/components/public/registration-form/registration-form.tsx`:

```tsx
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
  const [memberCardFiles, setMemberCardFiles] = useState<Map<number, File>>(new Map())

  const form = useForm<SubmitRegistrationInput>({
    resolver: zodResolver(submitRegistrationSchema as never) as Resolver<SubmitRegistrationInput>,
    defaultValues: {
      ticketCategoryId: event.ticketCategories?.[0]?.id ?? '',
      ticketQty: 1,
      holders: [{ holderName: '', holderWhatsapp: '', claimedMemberNumber: '', mandatoryMenuItemId: '' }],
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
  }, [])

  const selectedCategoryId = form.watch('ticketCategoryId')
  const ticketQty = form.watch('ticketQty')
  const holders = form.watch('holders')

  const selectedCategory = useMemo(
    () => event.ticketCategories?.find(c => c.id === selectedCategoryId),
    [event.ticketCategories, selectedCategoryId],
  )

  const pricingHolders = event.requireAllHolderData
    ? holders
    : Array.from(
        { length: ticketQty },
        () => holders[0] ?? { holderName: '', holderWhatsapp: '', claimedMemberNumber: '', mandatoryMenuItemId: '' },
      )
  const pricingValidations = event.requireAllHolderData
    ? holderValidations
    : Array.from({ length: ticketQty }, () => holderValidations[0] ?? ('unknown' as const))

  const pricing = usePricingPreview({
    category: selectedCategory,
    holders: pricingHolders,
    holderValidations: pricingValidations,
  })

  function handleQtyChange(qty: number) {
    form.setValue('ticketQty', qty)
    if (event.requireAllHolderData) {
      const current = form.getValues('holders')
      const next = Array.from(
        { length: qty },
        (_, i) =>
          current[i] ?? { holderName: '', holderWhatsapp: '', claimedMemberNumber: '', mandatoryMenuItemId: '' },
      )
      replace(next)
      setHolderValidations(prev => Array.from({ length: qty }, (_, i) => prev[i] ?? 'unknown'))
    }
  }

  async function handleNext() {
    const valid = await form.trigger()
    if (!valid) return

    const currentHolders = form.getValues('holders')
    const missingFile = currentHolders.some((h, i) => h.memberType === 'regional' && !memberCardFiles.has(i))
    if (missingFile) {
      form.setError('root', {
        message: 'Upload bukti kartu member untuk semua peserta Member CISC Regional sebelum melanjutkan.',
      })
      return
    }

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
```

- [ ] **Step 3: Update `StepTwo` to show member type in summary**

In `src/components/public/registration-form/step-two.tsx`, update the `Props` type to accept `holders` and update the summary label. Replace file contents:

```tsx
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
  holders: SubmitRegistrationInput['holders']
  onBack: () => void
  isSubmitting: boolean
}

function memberTypeLabel(h: SubmitRegistrationInput['holders'][number]): string {
  if (h.memberType === 'tangsel') return 'Member Tangsel'
  if (h.memberType === 'regional') return 'Member Regional'
  return 'Non-member'
}

export function StepTwo({ event, selectedCategory, pricing, holders, onBack, isSubmitting }: Props) {
  const form = useFormContext<SubmitRegistrationInput>()

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
                Tiket {i + 1} ({memberTypeLabel(h)})
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
```

- [ ] **Step 4: Commit**

```bash
git add src/components/public/registration-form/step-one.tsx \
        src/components/public/registration-form/registration-form.tsx \
        src/components/public/registration-form/step-two.tsx
git commit -m "feat(public): wire member card file state through registration form"
```

---

## Task 6: Server action — handle regional member files

**Files:**
- Modify: `src/lib/actions/submit-registration.ts`

- [ ] **Step 1: Update `submitRegistration` to handle regional files**

Replace the entire contents of `src/lib/actions/submit-registration.ts`:

```ts
'use server'

import { MemberType, RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { submitRegistrationSchema } from '@/lib/forms/submit-registration-schema'
import { computeSubmitTotal } from '@/lib/pricing/compute-submit-total'
import {
  assertRegistrationAcceptableOrThrowForTx,
  countRegistrationsTowardQuota,
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
  RegistrationNotAcceptableError,
} from '@/lib/events/registration-window'
import {
  DEFAULT_GLOBAL_REGISTRATION_CLOSED,
  mergeGlobalRegistrationClosure,
} from '@/lib/public/club-operational-policy'
import { loadClubOperationalSettings } from '@/lib/public/load-club-operational-settings'
import { uploadImageForRegistration } from '@/lib/uploads/upload-image'

export type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'

export async function submitRegistration(
  eventId: string,
  formData: FormData,
): Promise<ActionResult<{ registrationId: string }>> {
  // 1. Parse holders from JSON
  let holdersRaw: unknown
  try {
    holdersRaw = JSON.parse(formData.get('holders') as string)
  } catch {
    return rootError('Data peserta tidak valid.')
  }

  const rawInput = {
    ticketCategoryId: formData.get('ticketCategoryId'),
    ticketQty: Number(formData.get('ticketQty')),
    holders: holdersRaw,
  }

  const parsed = submitRegistrationSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return rootError(firstIssue?.message ?? 'Data tidak valid.')
  }

  const input = parsed.data

  // 2. Collect and validate regional member card files
  const regionalFiles = new Map<number, File>()
  for (let i = 0; i < input.holders.length; i++) {
    if (input.holders[i]?.memberType !== 'regional') continue
    const raw = formData.get(`memberCardPhoto_${i}`)
    if (!(raw instanceof File) || raw.size === 0) {
      return rootError('Bukti kartu member wajib diupload untuk peserta Member CISC Regional.')
    }
    regionalFiles.set(i, raw)
  }

  // 3. Fetch event + category + club settings in parallel
  const [event, opsGate] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        registrationManualClosed: true,
        openRegistrationAt: true,
        closeRegistrationAt: true,
        registrationCapacity: true,
        requireAllHolderData: true,
        ticketCategories: {
          where: { id: input.ticketCategoryId, isActive: true },
          select: {
            id: true,
            regularPrice: true,
            memberPrice: true,
            maxQtyPerPerson: true,
          },
        },
      },
    }),
    loadClubOperationalSettings(),
  ])

  if (!event) return rootError('Acara tidak ditemukan.')

  // 4. Check registration window (local + global)
  const registrationsTowardQuotaPreview = await countRegistrationsTowardQuota(prisma, event.id)
  const locallyOpen = isRegistrationOpenForEvent({
    event,
    registrationsTowardQuota: registrationsTowardQuotaPreview,
  })
  const mergedGate = mergeGlobalRegistrationClosure({
    registrationOpen: locallyOpen,
    registrationClosedMessage: locallyOpen
      ? null
      : registrationBlockMessageForPublic({
          eventStatus: event.status,
          registrationManualClosed: event.registrationManualClosed,
          registrationCapacity: event.registrationCapacity,
          registrationsTowardQuota: registrationsTowardQuotaPreview,
          openRegistrationAt: event.openRegistrationAt,
          closeRegistrationAt: event.closeRegistrationAt,
        }),
    registrationGloballyDisabled: opsGate.registrationGloballyDisabled,
    globalRegistrationClosedMessage: opsGate.globalRegistrationClosedMessage,
  })
  if (!mergedGate.registrationOpen) {
    return rootError(mergedGate.registrationClosedMessage ?? DEFAULT_GLOBAL_REGISTRATION_CLOSED)
  }

  // 5. Validate category
  const category = event.ticketCategories[0]
  if (!category) return rootError('Kategori tiket tidak tersedia.')

  if (category.maxQtyPerPerson !== null && input.ticketQty > category.maxQtyPerPerson) {
    return rootError(`Maksimal ${category.maxQtyPerPerson} tiket untuk kategori ini.`)
  }

  if (event.requireAllHolderData) {
    if (input.holders.length !== input.ticketQty) {
      return rootError('Jumlah data peserta tidak sesuai dengan jumlah tiket.')
    }
  } else {
    if (input.holders.length !== 1) {
      return rootError('Jumlah data peserta tidak valid.')
    }
  }

  const holdersForProcessing = event.requireAllHolderData
    ? input.holders
    : Array.from({ length: input.ticketQty }, () => ({ ...input.holders[0]! }))

  // 6. Compute pricing (server always uses 'unknown' — admin verifies member status)
  const pricing = computeSubmitTotal({
    holders: holdersForProcessing.map(h => ({
      memberValidation: 'unknown' as const,
      category: {
        regularPrice: category.regularPrice,
        memberPrice: category.memberPrice,
      },
      menuItem: h.mandatoryMenuItemId ? { price: 0, name: '' } : null,
    })),
  })

  // 7. Create Registration + RegistrationHolder[] in a transaction
  let reg: { id: string; holders: { id: string; sortOrder: number }[] }
  try {
    reg = await prisma.$transaction(async tx => {
      await assertRegistrationAcceptableOrThrowForTx(tx, event)

      const contactName = input.holders[0].holderName
      const contactWhatsapp = input.holders[0].holderWhatsapp ?? ''

      return tx.registration.create({
        data: {
          eventId: event.id,
          ticketCategoryId: input.ticketCategoryId,
          ticketQty: input.ticketQty,
          contactName,
          contactWhatsapp,
          computedTotalAtSubmit: pricing.grandTotal,
          status: RegistrationStatus.submitted,
          holders: {
            create: holdersForProcessing.map((h, i) => ({
              sortOrder: i + 1,
              holderName: h.holderName,
              holderWhatsapp: h.holderWhatsapp?.trim() || null,
              claimedMemberNumber: h.claimedMemberNumber?.trim() || null,
              memberType: h.memberType ? (h.memberType as MemberType) : null,
              ticketPriceApplied: pricing.lines[i]!.ticketPrice,
              mandatoryMenuItemId: h.mandatoryMenuItemId?.trim() || null,
              mandatoryMenuPriceApplied: null,
            })),
          },
        },
        include: {
          holders: {
            select: { id: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      })
    })
  } catch (e) {
    if (e instanceof RegistrationNotAcceptableError) {
      return rootError(e.message)
    }
    console.error(e)
    return rootError('Gagal menyimpan pendaftaran. Coba lagi.')
  }

  // 8. Upload member card photos for regional holders (non-fatal)
  for (const [inputIndex, file] of regionalFiles) {
    const holderRow = reg.holders[inputIndex]
    if (!holderRow) continue
    try {
      await uploadImageForRegistration({
        purpose: 'member_card_photo',
        registrationId: reg.id,
        registrationHolderId: holderRow.id,
        file,
      })
    } catch (e) {
      console.error(`[submitRegistration] Failed to upload member card photo for holder index ${inputIndex}:`, e)
    }
  }

  return ok({ registrationId: reg.id })
}
```

- [ ] **Step 2: Run type check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm build 2>&1 | grep -E "error TS|Type error" | head -20
```

Expected: no TypeScript errors in `submit-registration.ts` or related files.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/submit-registration.ts
git commit -m "feat(action): handle regional member files in submitRegistration"
```

---

## Task 7: Admin — update types and page query

**Files:**
- Modify: `src/components/admin/registration-detail-panels/shared/registration-detail-types.ts`
- Modify: `src/app/admin/events/[eventId]/registrants/[registrationId]/page.tsx`

- [ ] **Step 1: Add `memberType` and `registrationHolderId` to detail types**

Replace the entire contents of `src/components/admin/registration-detail-panels/shared/registration-detail-types.ts`:

```ts
import type {
  AttendanceStatus,
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
  MemberType,
  MemberValidation,
  RegistrationStatus,
  UploadPurpose,
} from '@prisma/client'

export type DetailRegistration = {
  id: string
  createdAt: Date
  contactName: string
  contactWhatsapp: string
  computedTotalAtSubmit: number
  status: RegistrationStatus
  attendanceStatus: AttendanceStatus
  rejectionReason: string | null
  paymentIssueReason: string | null
  ticketQty: number
  ticketCategory: {
    id: string
    name: string
    regularPrice: number
    memberPrice: number
  }
  holders: Array<{
    id: string
    sortOrder: number
    holderName: string
    claimedMemberNumber: string | null
    memberValidation: MemberValidation
    memberType: MemberType | null
    ticketPriceApplied: number
    menuItemName: string | null
  }>
  event: {
    title: string
    venueName: string
    kickOffAt: Date
    menuItems: Array<{ id: string; name: string; price: number }>
    bankAccount: { bankName: string; accountNumber: string; accountName: string } | null
  }
  uploads: Array<{
    id: string
    purpose: UploadPurpose
    blobUrl: string
    contentType: string
    bytes: number
    width: number | null
    height: number | null
    originalFilename: string | null
    createdAt: Date
    registrationHolderId: string | null
  }>
  adjustments: Array<{
    id: string
    type: InvoiceAdjustmentType
    amount: number
    status: InvoiceAdjustmentStatus
    paidAt: Date | null
    createdAt: Date
    uploads: Array<{ id: string; blobUrl: string; bytes: number; createdAt: Date }>
  }>
}
```

- [ ] **Step 2: Update page query to select new fields and map them**

In `src/app/admin/events/[eventId]/registrants/[registrationId]/page.tsx`:

In the `holders` select block (around line 82–93), add `memberType`:
```ts
holders: {
  orderBy: { sortOrder: 'asc' as const },
  select: {
    id: true,
    sortOrder: true,
    holderName: true,
    claimedMemberNumber: true,
    memberValidation: true,
    memberType: true,        // ADD THIS
    ticketPriceApplied: true,
    mandatoryMenuItem: { select: { name: true } },
  },
},
```

In the `uploads` select (around line 111), add `registrationHolderId`:
```ts
uploads: {
  orderBy: { createdAt: 'asc' as const },
  select: {
    id: true,
    purpose: true,
    blobUrl: true,
    contentType: true,
    bytes: true,
    width: true,
    height: true,
    originalFilename: true,
    createdAt: true,
    registrationHolderId: true,   // ADD THIS
  },
},
```

In the `registrationForDetail` mapping (around line 148), update the holders map to include `memberType`:
```ts
holders: registration.holders.map(h => ({
  id: h.id,
  sortOrder: h.sortOrder,
  holderName: h.holderName,
  claimedMemberNumber: h.claimedMemberNumber,
  memberValidation: h.memberValidation,
  memberType: h.memberType,       // ADD THIS
  ticketPriceApplied: h.ticketPriceApplied,
  menuItemName: h.mandatoryMenuItem?.name ?? null,
})),
```

The `uploads` from the Prisma result are passed through as `...registrationRest` (which includes `uploads`). Since we now select `registrationHolderId` in the query, it will be included automatically in `registrationRest.uploads`. No additional mapping needed.

- [ ] **Step 3: Build check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm build 2>&1 | grep -E "error TS|Type error" | head -20
```

Expected: no TypeScript errors in these files. Any remaining errors will be in Tasks 8–9 (components that use `DetailRegistration` but haven't been updated yet).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/registration-detail-panels/shared/registration-detail-types.ts \
        "src/app/admin/events/[eventId]/registrants/[registrationId]/page.tsx"
git commit -m "feat(admin): add memberType and registrationHolderId to registration detail types and query"
```

---

## Task 8: Admin — holders section shows Tipe Member column

**Files:**
- Modify: `src/components/admin/registration-detail-panels/tab-summary/holders-section.tsx`

- [ ] **Step 1: Add Tipe Member column**

Replace the entire contents of `src/components/admin/registration-detail-panels/tab-summary/holders-section.tsx`:

```tsx
import type { MemberType } from '@prisma/client'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'
import { formatCurrencyIdr } from '@/components/admin/registration-detail-panels/shared/format'

type Props = {
  registration: DetailRegistration
}

function memberValidationLabel(v: string): string {
  if (v === 'verified') return 'Terverifikasi'
  if (v === 'rejected') return 'Ditolak'
  return 'Belum diverifikasi'
}

function memberTypeLabel(t: MemberType | null): string {
  if (t === 'tangsel') return 'Tangsel'
  if (t === 'regional') return 'Regional'
  return '—'
}

export function HoldersSection({ registration }: Props) {
  const { holders, ticketCategory, ticketQty } = registration

  return (
    <div className='grid gap-3 text-sm'>
      <div className='flex flex-wrap justify-between gap-2'>
        <span className='text-muted-foreground'>Kategori tiket</span>
        <span className='font-medium'>{ticketCategory.name}</span>
      </div>
      <div className='flex flex-wrap justify-between gap-2'>
        <span className='text-muted-foreground'>Jumlah tiket</span>
        <span className='font-medium'>{ticketQty}</span>
      </div>
      <div className='overflow-x-auto rounded-md border'>
        <table className='w-full text-sm'>
          <thead className='bg-muted/50'>
            <tr>
              <th className='px-3 py-2 text-left font-medium'>#</th>
              <th className='px-3 py-2 text-left font-medium'>Nama</th>
              <th className='px-3 py-2 text-left font-medium'>Tipe Member</th>
              <th className='px-3 py-2 text-left font-medium'>No. Member</th>
              <th className='px-3 py-2 text-left font-medium'>Status</th>
              <th className='px-3 py-2 text-left font-medium'>Menu</th>
              <th className='px-3 py-2 text-right font-medium'>Harga</th>
            </tr>
          </thead>
          <tbody>
            {holders.map(h => (
              <tr key={h.id} className='border-t'>
                <td className='px-3 py-2 text-muted-foreground'>{h.sortOrder}</td>
                <td className='px-3 py-2 font-medium'>{h.holderName}</td>
                <td className='px-3 py-2'>{memberTypeLabel(h.memberType)}</td>
                <td className='px-3 py-2'>{h.claimedMemberNumber ?? '—'}</td>
                <td className='px-3 py-2'>{memberValidationLabel(h.memberValidation)}</td>
                <td className='px-3 py-2'>{h.menuItemName ?? '—'}</td>
                <td className='px-3 py-2 text-right font-mono'>{formatCurrencyIdr(h.ticketPriceApplied)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/registration-detail-panels/tab-summary/holders-section.tsx
git commit -m "feat(admin): add Tipe Member column to holders section"
```

---

## Task 9: Admin — evidence section labels regional member card photos

**Files:**
- Modify: `src/components/admin/registration-detail-panels/tab-verification/evidence-section.tsx`

- [ ] **Step 1: Update evidence section to label regional uploads by holder**

The upload now has `registrationHolderId`. When it's set and the purpose is `member_card_photo`, label it as "Foto kartu member (regional)". We use the existing `registration.holders` to find the holder's name.

Replace the entire contents of `src/components/admin/registration-detail-panels/tab-verification/evidence-section.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/registration-detail-panels/tab-verification/evidence-section.tsx
git commit -m "feat(admin): label regional member card photos by holder in evidence section"
```

---

## Task 10: Final build + full test run

- [ ] **Step 1: Run all tests**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm test
```

Expected: all tests pass, including the new `submit-registration-schema.test.ts`.

- [ ] **Step 2: Full build**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm build 2>&1 | tail -30
```

Expected: build succeeds with no TypeScript errors. Next.js compilation warnings are acceptable.

- [ ] **Step 3: Update CLAUDE.md**

In `CLAUDE.md`, under **Data model** → `RegistrationHolder`, add after the existing holder description:

> `memberType MemberType?` (`null` = non-member, `tangsel` = direktori Tangsel, `regional` = manual claim + upload bukti)

Under **Uploads**, add:

> `registrationHolderId` pada `Upload` mengaitkan upload `member_card_photo` ke `RegistrationHolder` spesifik (untuk klaim member regional dengan beberapa holder)

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document MemberType and registrationHolderId"
```
