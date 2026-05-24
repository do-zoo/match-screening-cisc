# Holder WhatsApp Required Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `holderWhatsapp` required and validated for secondary ticket holders (Tiket 2+), while silently deriving the primary holder's WA from `contactWhatsapp`.

**Architecture:** Schema made uniform (WA required for all holders), UI hides the WA field for the primary holder, and the client syncs `contactWhatsapp → holders[0].holderWhatsapp` at `handleNext` and `onSubmit`. No server action changes needed.

**Tech Stack:** Zod, React Hook Form, `libphonenumber-js`, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/lib/forms/submit-registration-schema.ts` | Rename schema, export it, make `holderWhatsapp` required |
| `src/lib/forms/submit-registration-schema.test.ts` | Update fixtures, add tests for required WA |
| `src/components/public/registration-form/holder-card.tsx` | Hide WA field for primary holder, remove "(opsional)" |
| `src/components/public/registration-form/registration-form.tsx` | Sync `contactWhatsapp` to primary holder at `handleNext` and `onSubmit` |

---

## Task 1: Update tests, then update schema

**Files:**
- Modify: `src/lib/forms/submit-registration-schema.test.ts`
- Modify: `src/lib/forms/submit-registration-schema.ts`

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `src/lib/forms/submit-registration-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { holderSchema, submitRegistrationSchema } from './submit-registration-schema'

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ticketCategoryId: 'cat-1',
    ticketQty: 1,
    holders: [{ holderName: 'Budi Santoso', holderWhatsapp: '08123456789', claimedMemberNumber: '', mandatoryMenuItemId: '' }],
    contactWhatsapp: '08123456789',
    ...overrides,
  }
}

describe('holderSchema', () => {
  it('accepts a holder with valid name and WA', () => {
    const r = holderSchema.safeParse({ holderName: 'Budi', holderWhatsapp: '08123456789' })
    expect(r.success).toBe(true)
  })

  it('rejects holder missing holderWhatsapp', () => {
    const r = holderSchema.safeParse({ holderName: 'Budi' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'holderWhatsapp')).toBe(true)
    }
  })

  it('rejects holder with invalid holderWhatsapp', () => {
    const r = holderSchema.safeParse({ holderName: 'Budi', holderWhatsapp: '123' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'holderWhatsapp')).toBe(true)
    }
  })

  it('rejects empty holderName', () => {
    const r = holderSchema.safeParse({ holderName: '', holderWhatsapp: '08123456789' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path[0]).toBe('holderName')
    }
  })

  it('trims whitespace-only holderName', () => {
    const r = holderSchema.safeParse({ holderName: '   ', holderWhatsapp: '08123456789' })
    expect(r.success).toBe(false)
  })

  it('accepts optional claimedMemberNumber', () => {
    const r = holderSchema.safeParse({ holderName: 'Budi', holderWhatsapp: '08123456789', claimedMemberNumber: 'CISC-001' })
    expect(r.success).toBe(true)
  })
})

describe('submitRegistrationSchema', () => {
  it('accepts a valid payload with 1 holder', () => {
    const r = submitRegistrationSchema.safeParse(validPayload())
    expect(r.success).toBe(true)
  })

  it('rejects missing ticketCategoryId', () => {
    const r = submitRegistrationSchema.safeParse(validPayload({ ticketCategoryId: '' }))
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'ticketCategoryId')).toBe(true)
    }
  })

  it('rejects ticketQty < 1', () => {
    const r = submitRegistrationSchema.safeParse(validPayload({ ticketQty: 0 }))
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'ticketQty')).toBe(true)
    }
  })

  it('rejects empty holders array', () => {
    const r = submitRegistrationSchema.safeParse(validPayload({ holders: [] }))
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'holders')).toBe(true)
    }
  })

  it('accepts multiple holders each with valid WA', () => {
    const r = submitRegistrationSchema.safeParse(
      validPayload({
        ticketQty: 2,
        holders: [
          { holderName: 'Budi', holderWhatsapp: '08123456789', claimedMemberNumber: 'CISC-001' },
          { holderName: 'Rina', holderWhatsapp: '08198765432' },
        ],
      }),
    )
    expect(r.success).toBe(true)
  })

  it('rejects secondary holder missing holderWhatsapp', () => {
    const r = submitRegistrationSchema.safeParse(
      validPayload({
        ticketQty: 2,
        holders: [
          { holderName: 'Budi', holderWhatsapp: '08123456789' },
          { holderName: 'Rina' },
        ],
      }),
    )
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(
        r.error.issues.some(i => i.path[0] === 'holders' && i.path[2] === 'holderWhatsapp'),
      ).toBe(true)
    }
  })

  it('rejects secondary holder with invalid holderWhatsapp', () => {
    const r = submitRegistrationSchema.safeParse(
      validPayload({
        ticketQty: 2,
        holders: [
          { holderName: 'Budi', holderWhatsapp: '08123456789' },
          { holderName: 'Rina', holderWhatsapp: '123' },
        ],
      }),
    )
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(
        r.error.issues.some(i => i.path[0] === 'holders' && i.path[2] === 'holderWhatsapp'),
      ).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run tests — expect 4 failures**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/forms/submit-registration-schema.test.ts
```

Expected: 4 FAIL
- `holderSchema > rejects holder missing holderWhatsapp`
- `holderSchema > rejects holder with invalid holderWhatsapp`
- `submitRegistrationSchema > rejects secondary holder missing holderWhatsapp`
- `submitRegistrationSchema > rejects secondary holder with invalid holderWhatsapp`

- [ ] **Step 3: Update the schema**

Replace the entire contents of `src/lib/forms/submit-registration-schema.ts`:

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
})

export type HolderInput = z.infer<typeof holderSchema>

export const submitRegistrationSchema = z.object({
  ticketCategoryId: z.string().min(1, 'Pilih kategori tiket'),
  ticketQty: z.number().int().min(1, 'Jumlah tiket minimal 1'),
  holders: z.array(holderSchema).min(1, 'Minimal satu pemegang tiket'),
  contactWhatsapp: whatsappPhoneSchema,
})

export type SubmitRegistrationInput = z.infer<typeof submitRegistrationSchema>
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/forms/submit-registration-schema.test.ts
```

Expected: all tests PASS (12 passed)

- [ ] **Step 5: Commit**

```bash
git add src/lib/forms/submit-registration-schema.ts src/lib/forms/submit-registration-schema.test.ts
git commit -m "feat(registration): make holderWhatsapp required with phone validation"
```

---

## Task 2: Hide WA field for primary holder in UI

**Files:**
- Modify: `src/components/public/registration-form/holder-card.tsx`

- [ ] **Step 1: Update `WhatsAppField` — remove the "(opsional)" span**

In `src/components/public/registration-form/holder-card.tsx`, find `WhatsAppField` (lines 37–63) and change the `FieldLabel`:

Old:
```tsx
<FieldLabel htmlFor={`holder-${index}-wa`}>
  Nomor WhatsApp{' '}
  <span className='font-normal text-muted-foreground'>(opsional)</span>
</FieldLabel>
```

New:
```tsx
<FieldLabel htmlFor={`holder-${index}-wa`}>Nomor WhatsApp</FieldLabel>
```

- [ ] **Step 2: Skip WA for primary holder in non-member path**

In `HolderCard`, find the non-member path block (around line 285–299):

Old:
```tsx
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
```

New:
```tsx
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
    {!isPrimary && <WhatsAppField index={index} />}
  </>
)}
```

- [ ] **Step 3: Skip WA alert and field for primary holder in member-verified-no-WA path**

Find the member path block (around line 262–279):

Old:
```tsx
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
          Nomor WhatsApp member ini belum terdaftar di direktori. Isi nomor di bawah agar panitia bisa menghubungi peserta.
        </Alert>
        <WhatsAppField index={index} />
      </>
    )}
  </>
)}
```

New:
```tsx
{isMember && validationResult.status === 'valid' && (
  <>
    <MemberProfileCard
      fullName={validationResult.fullName}
      whatsapp={validationResult.whatsapp}
      onReset={handleResetMemberNumber}
    />
    {/* If directory has no WA, let the user fill it in (secondary holders only) */}
    {memberVerifiedNoWa && !isPrimary && (
      <>
        <Alert variant='destructive' className='text-sm'>
          Nomor WhatsApp member ini belum terdaftar di direktori. Isi nomor di bawah agar panitia bisa menghubungi peserta.
        </Alert>
        <WhatsAppField index={index} />
      </>
    )}
  </>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/public/registration-form/holder-card.tsx
git commit -m "feat(registration): hide WA field for primary holder, remove (opsional) label"
```

---

## Task 3: Sync primary holder WA from contactWhatsapp

**Files:**
- Modify: `src/components/public/registration-form/registration-form.tsx`

- [ ] **Step 1: Update `handleNext` to sync primary holder WA before validation**

In `src/components/public/registration-form/registration-form.tsx`, find `handleNext` (around line 69–72):

Old:
```ts
async function handleNext() {
  const valid = await form.trigger()
  if (valid) setStep(2)
}
```

New:
```ts
async function handleNext() {
  form.setValue('holders.0.holderWhatsapp', form.getValues('contactWhatsapp'))
  const valid = await form.trigger()
  if (valid) setStep(2)
}
```

- [ ] **Step 2: Update `onSubmit` to set primary holder WA before building FormData**

Find `onSubmit` (around line 74–89):

Old:
```ts
async function onSubmit(values: SubmitRegistrationInput) {
  const formData = new FormData()
  formData.append('ticketCategoryId', values.ticketCategoryId)
  formData.append('ticketQty', String(values.ticketQty))
  formData.append('holders', JSON.stringify(values.holders))
  formData.append('contactWhatsapp', values.contactWhatsapp)

  const result = await submitRegistration(event.id, formData)
  if (result.ok) {
    router.push(`/events/${event.slug}/register/${result.data.registrationId}`)
    return
  }

  toastActionErr(result)
  if (result.rootError) form.setError('root', { message: result.rootError })
}
```

New:
```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/public/registration-form/registration-form.tsx
git commit -m "feat(registration): sync contactWhatsapp to primary holder before submit"
```

---

## Task 4: Full test suite verification

- [ ] **Step 1: Run full test suite**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm test
```

Expected: all existing tests pass (no regressions)

- [ ] **Step 2: Run type check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm exec tsc --noEmit
```

Expected: no type errors
