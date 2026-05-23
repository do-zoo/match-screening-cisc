# Registration Form 3-Step Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ubah form pendaftaran publik dari satu halaman menjadi wizard 2-step (isi data → ringkasan & kirim), lalu halaman konfirmasi status-aware yang menangani upload bukti bayar, konfirmasi pending, dan konfirmasi approved.

**Architecture:** `RegistrationForm` menambah `step: 1 | 2` state (client-side, react-hook-form tetap). Submit di Step 2 membuat Registration di DB (status `submitted`) tanpa bukti bayar. Halaman `/register/[id]` menjadi status-aware: tampilkan upload form jika `submitted`, konfirmasi jika `pending_review` atau `approved`.

**Tech Stack:** Next.js App Router, react-hook-form, Zod, Prisma, Vercel Blob, shadcn/ui, TypeScript, Vitest

---

## File Map

### Dimodifikasi
- `src/lib/forms/submit-registration-schema.ts` — hapus `transferProof`
- `src/lib/actions/submit-registration.ts` — hapus upload logic, tetap di status `submitted`
- `src/lib/actions/__tests__/submit-registration.integration.test.ts` — hapus `transferProof` dari test FormData
- `src/components/public/registration-form/registration-form.tsx` — tambah `step` state, render StepIndicator + StepOne/StepTwo
- `src/app/(public)/events/[slug]/register/[registrationId]/page.tsx` — status-aware routing ke panel yang tepat

### Dibuat
- `src/lib/actions/upload-transfer-proof.ts` — server action upload bukti + update status
- `src/lib/actions/__tests__/upload-transfer-proof.integration.test.ts` — integration tests
- `src/components/public/registration-form/step-indicator.tsx` — progress indicator 2 langkah
- `src/components/public/registration-form/step-one.tsx` — ekstrak data peserta dari form saat ini
- `src/components/public/registration-form/step-two.tsx` — ringkasan read-only + tombol kirim
- `src/components/public/registration-form/upload-proof-panel.tsx` — panel upload bukti (client)
- `src/components/public/registration-form/pending-review-panel.tsx` — panel konfirmasi pending
- `src/components/public/registration-form/approved-panel.tsx` — panel konfirmasi approved

---

## Task 1: Hapus `transferProof` dari schema dan action

**Files:**
- Modify: `src/lib/forms/submit-registration-schema.ts`
- Modify: `src/lib/actions/submit-registration.ts`
- Modify: `src/lib/actions/__tests__/submit-registration.integration.test.ts`

- [ ] **Step 1: Update schema — hapus field `transferProof`**

Edit `src/lib/forms/submit-registration-schema.ts`. Ganti seluruh isi menjadi:

```ts
import { isValidPhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'
import { toE164PlusForValidation } from '@/lib/forms/phone-value-string'

const contactWhatsappSchema = z
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
  holderWhatsapp: z.string().trim().optional(),
  claimedMemberNumber: z.string().trim().optional(),
  mandatoryMenuItemId: z.string().optional(),
})

export type HolderInput = z.infer<typeof holderSchema>

export const submitRegistrationSchema = z.object({
  ticketCategoryId: z.string().min(1, 'Pilih kategori tiket'),
  ticketQty: z.number().int().min(1, 'Jumlah tiket minimal 1'),
  holders: z.array(holderSchema).min(1, 'Minimal satu pemegang tiket'),
  contactWhatsapp: contactWhatsappSchema,
})

export type SubmitRegistrationInput = z.infer<typeof submitRegistrationSchema>
```

- [ ] **Step 2: Sederhanakan `submitRegistration` — hapus upload dan tetap di `submitted`**

Edit `src/lib/actions/submit-registration.ts`. Hapus import `del`, `uploadImageForRegistration`, `UploadError`, dan semua logika upload. Ubah blok akhir menjadi:

```ts
'use server'

import { RegistrationStatus } from '@prisma/client'
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
    contactWhatsapp: formData.get('contactWhatsapp'),
  }

  const parsed = submitRegistrationSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return rootError(firstIssue?.message ?? 'Data tidak valid.')
  }

  const input = parsed.data

  // 2. Fetch event + category + club settings in parallel
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

  // 3. Check registration window (local + global)
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

  // 4. Validate category
  const category = event.ticketCategories[0]
  if (!category) return rootError('Kategori tiket tidak tersedia.')

  if (category.maxQtyPerPerson !== null && input.ticketQty > category.maxQtyPerPerson) {
    return rootError(`Maksimal ${category.maxQtyPerPerson} tiket untuk kategori ini.`)
  }

  if (input.holders.length !== input.ticketQty) {
    return rootError('Jumlah data peserta tidak sesuai dengan jumlah tiket.')
  }

  // 5. Compute pricing (server always uses 'unknown' — admin verifies member status)
  const pricing = computeSubmitTotal({
    holders: input.holders.map(h => ({
      memberValidation: 'unknown' as const,
      category: {
        regularPrice: category.regularPrice,
        memberPrice: category.memberPrice,
      },
      menuItem: h.mandatoryMenuItemId ? { price: 0, name: '' } : null,
    })),
  })

  // 6. Create Registration + RegistrationHolder[] in a transaction
  try {
    const reg = await prisma.$transaction(async tx => {
      await assertRegistrationAcceptableOrThrowForTx(tx, event)

      const contactName = input.holders[0].holderName

      return tx.registration.create({
        data: {
          eventId: event.id,
          ticketCategoryId: input.ticketCategoryId,
          ticketQty: input.ticketQty,
          contactName,
          contactWhatsapp: input.contactWhatsapp,
          computedTotalAtSubmit: pricing.grandTotal,
          status: RegistrationStatus.submitted,
          holders: {
            create: input.holders.map((h, i) => ({
              sortOrder: i + 1,
              holderName: h.holderName,
              holderWhatsapp: h.holderWhatsapp?.trim() || null,
              claimedMemberNumber: h.claimedMemberNumber?.trim() || null,
              ticketPriceApplied: pricing.lines[i]!.ticketPrice,
              mandatoryMenuItemId: h.mandatoryMenuItemId?.trim() || null,
              mandatoryMenuPriceApplied: null,
            })),
          },
        },
      })
    })

    return ok({ registrationId: reg.id })
  } catch (e) {
    if (e instanceof RegistrationNotAcceptableError) {
      return rootError(e.message)
    }
    console.error(e)
    return rootError('Gagal menyimpan pendaftaran. Coba lagi.')
  }
}
```

- [ ] **Step 3: Update test — hapus `transferProof` dari FormData**

Edit `src/lib/actions/__tests__/submit-registration.integration.test.ts`. Hapus baris `fd.set('transferProof', ...)` dari test "mengembalikan error jika acara tidak ditemukan":

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    registration: { count: vi.fn() },
  },
}))

vi.mock('@/lib/public/load-club-operational-settings', () => ({
  loadClubOperationalSettings: vi.fn().mockResolvedValue({
    registrationGloballyDisabled: false,
    globalRegistrationClosedMessage: null,
  }),
}))

import { prisma } from '@/lib/db/prisma'
import { submitRegistration } from '../submit-registration'

describe('submitRegistration (integrasi ringan / tanpa DB nyata)', () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findUnique).mockReset()
  })

  it('mengembalikan error jika holders JSON tidak valid', async () => {
    const fd = new FormData()
    fd.set('holders', 'bukan-json')
    const r = await submitRegistration('event-123', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) {
      expect(r.rootError).toBeTruthy()
    }
  })

  it('mengembalikan error jika acara tidak ditemukan', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce(null)
    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '1')
    fd.set('holders', JSON.stringify([{ holderName: 'Tester' }]))
    fd.set('contactWhatsapp', '08123456789')
    const r = await submitRegistration('tidak-ada', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) {
      expect(r.rootError).toBeTruthy()
    }
  })
})
```

- [ ] **Step 4: Jalankan test dan verifikasi**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use
pnpm vitest run src/lib/actions/__tests__/submit-registration.integration.test.ts
```

Expected: semua test PASS

- [ ] **Step 5: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/forms/submit-registration-schema.ts src/lib/actions/submit-registration.ts src/lib/actions/__tests__/submit-registration.integration.test.ts
git commit -m "feat(registration): remove transferProof from submit — upload happens post-creation"
```

---

## Task 2: Server action `uploadTransferProof`

**Files:**
- Create: `src/lib/actions/upload-transfer-proof.ts`
- Create: `src/lib/actions/__tests__/upload-transfer-proof.integration.test.ts`

- [ ] **Step 1: Tulis failing test**

Buat `src/lib/actions/__tests__/upload-transfer-proof.integration.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RegistrationStatus } from '@prisma/client'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    registration: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/uploads/upload-image', () => ({
  uploadImageForRegistration: vi.fn(),
}))

import { prisma } from '@/lib/db/prisma'
import { uploadImageForRegistration } from '@/lib/uploads/upload-image'
import { uploadTransferProof } from '../upload-transfer-proof'

const mockFindUnique = vi.mocked(prisma.registration.findUnique)
const mockUpdate = vi.mocked(prisma.registration.update)
const mockUpload = vi.mocked(uploadImageForRegistration)

describe('uploadTransferProof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mengembalikan error jika tidak ada file', async () => {
    const fd = new FormData()
    const r = await uploadTransferProof('reg-1', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) expect(r.rootError).toMatch(/wajib/)
  })

  it('mengembalikan error jika registration tidak ditemukan', async () => {
    mockFindUnique.mockResolvedValue(null)
    const fd = new FormData()
    fd.append('transferProof', new File(['x'], 'proof.jpg', { type: 'image/jpeg' }))
    const r = await uploadTransferProof('reg-1', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) expect(r.rootError).toMatch(/tidak ditemukan/)
  })

  it('mengembalikan error jika status bukan submitted', async () => {
    mockFindUnique.mockResolvedValue({ id: 'reg-1', status: RegistrationStatus.pending_review } as never)
    const fd = new FormData()
    fd.append('transferProof', new File(['x'], 'proof.jpg', { type: 'image/jpeg' }))
    const r = await uploadTransferProof('reg-1', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) expect(r.rootError).toMatch(/sudah dikirim/)
  })

  it('upload berhasil dan status naik ke pending_review', async () => {
    mockFindUnique.mockResolvedValue({ id: 'reg-1', status: RegistrationStatus.submitted } as never)
    mockUpload.mockResolvedValue({ uploadId: 'u1', url: 'https://example.com/proof.webp' })
    mockUpdate.mockResolvedValue({ id: 'reg-1' } as never)
    const fd = new FormData()
    fd.append('transferProof', new File(['x'], 'proof.jpg', { type: 'image/jpeg' }))
    const r = await uploadTransferProof('reg-1', fd)
    expect(r.ok).toBe(true)
    expect(mockUpload).toHaveBeenCalledWith({
      purpose: 'transfer_proof',
      registrationId: 'reg-1',
      file: expect.any(File),
    })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'reg-1' },
      data: { status: RegistrationStatus.pending_review },
    })
  })
})
```

- [ ] **Step 2: Jalankan test untuk verifikasi FAIL**

```bash
pnpm vitest run src/lib/actions/__tests__/upload-transfer-proof.integration.test.ts
```

Expected: FAIL dengan "Cannot find module '../upload-transfer-proof'"

- [ ] **Step 3: Implementasi action**

Buat `src/lib/actions/upload-transfer-proof.ts`:

```ts
'use server'

import { RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { uploadImageForRegistration } from '@/lib/uploads/upload-image'
import { UploadError } from '@/lib/uploads/errors'

export async function uploadTransferProof(
  registrationId: string,
  formData: FormData,
): Promise<ActionResult<null>> {
  const file = formData.get('transferProof')
  if (!(file instanceof File) || file.size === 0) {
    return rootError('Bukti transfer wajib diunggah.')
  }

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, status: true },
  })

  if (!registration) return rootError('Pendaftaran tidak ditemukan.')
  if (registration.status !== RegistrationStatus.submitted) {
    return rootError('Bukti transfer sudah dikirim sebelumnya.')
  }

  try {
    await uploadImageForRegistration({
      purpose: 'transfer_proof',
      registrationId,
      file,
    })

    await prisma.registration.update({
      where: { id: registrationId },
      data: { status: RegistrationStatus.pending_review },
    })

    return ok(null)
  } catch (e) {
    if (e instanceof UploadError) {
      return rootError('Gagal mengunggah gambar. Coba unggah ulang.')
    }
    console.error(e)
    return rootError('Gagal mengirim bukti transfer. Coba lagi.')
  }
}
```

- [ ] **Step 4: Jalankan test — verifikasi PASS**

```bash
pnpm vitest run src/lib/actions/__tests__/upload-transfer-proof.integration.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/upload-transfer-proof.ts src/lib/actions/__tests__/upload-transfer-proof.integration.test.ts
git commit -m "feat(registration): add uploadTransferProof server action"
```

---

## Task 3: Komponen `StepIndicator`

**Files:**
- Create: `src/components/public/registration-form/step-indicator.tsx`

- [ ] **Step 1: Buat komponen**

Buat `src/components/public/registration-form/step-indicator.tsx`:

```tsx
import { cn } from '@/lib/utils'

type StepState = 'active' | 'done' | 'upcoming'

function StepBubble({ n, label, state }: { n: number; label: string; state: StepState }) {
  const isDone = state === 'done'
  const isActive = state === 'active'
  return (
    <div className='flex flex-col items-center gap-1.5'>
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors',
          (isActive || isDone) && 'bg-primary text-primary-foreground',
          state === 'upcoming' && 'border border-border bg-muted text-muted-foreground',
        )}
      >
        {isDone ? '✓' : n}
      </div>
      <span
        className={cn(
          'max-w-20 text-center text-xs',
          (isActive || isDone) ? 'font-medium text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  )
}

type Props = { current: 1 | 2 }

export function StepIndicator({ current }: Props) {
  return (
    <nav aria-label='Langkah pendaftaran' className='mb-6 flex items-start justify-center gap-0'>
      <StepBubble n={1} label='Data Peserta' state={current === 1 ? 'active' : 'done'} />
      <div className={cn('mt-4 h-0.5 w-12 shrink-0 transition-colors', current > 1 ? 'bg-primary' : 'bg-border')} />
      <StepBubble n={2} label='Ringkasan & Kirim' state={current === 2 ? 'active' : 'upcoming'} />
    </nav>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/public/registration-form/step-indicator.tsx
git commit -m "feat(registration): add StepIndicator component"
```

---

## Task 4: Komponen `StepOne`

**Files:**
- Create: `src/components/public/registration-form/step-one.tsx`

Komponen ini mengekstrak konten Step 1 dari `registration-form.tsx` yang akan direfaktor di Task 6. Isi dari `StepOne` adalah CategoryPicker + HolderCards + contactWhatsapp + pricing preview.

- [ ] **Step 1: Buat komponen**

Buat `src/components/public/registration-form/step-one.tsx`:

```tsx
'use client'

import { useCallback } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import type { FieldArrayWithId } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatIdr } from '@/lib/utils/format-idr'
import type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'
import type { SerializedEventForRegistration } from '@/components/public/event-serialization'
import type { usePricingPreview } from './use-pricing-preview'

import { CategoryPicker } from './category-picker'
import { HolderCard } from './holder-card'

type Props = {
  event: SerializedEventForRegistration
  fields: FieldArrayWithId<SubmitRegistrationInput, 'holders'>[]
  ticketQty: number
  selectedCategoryId: string
  holderValidations: ('valid' | 'invalid' | 'unknown')[]
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
  holderValidations,
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
          {fields.map((field, index) => (
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

      {/* Kontak WhatsApp */}
      <div className='space-y-4 rounded-xl border border-border bg-card/80 px-5 py-5 shadow-sm'>
        <h2 className='text-xl font-semibold tracking-tight'>Kontak</h2>
        <Controller
          control={form.control}
          name='contactWhatsapp'
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor='ms-registration-whatsapp'>Nomor WhatsApp</FieldLabel>
              <Input
                id='ms-registration-whatsapp'
                type='tel'
                placeholder='+62 812 xxxx xxxx'
                aria-invalid={fieldState.invalid}
                {...field}
              />
              {fieldState.error && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
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

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/public/registration-form/step-one.tsx
git commit -m "feat(registration): add StepOne component"
```

---

## Task 5: Komponen `StepTwo`

**Files:**
- Create: `src/components/public/registration-form/step-two.tsx`

Komponen read-only yang membaca data dari form context dan menampilkan ringkasan sebelum submit.

- [ ] **Step 1: Buat komponen**

Buat `src/components/public/registration-form/step-two.tsx`:

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
  onBack: () => void
  isSubmitting: boolean
}

export function StepTwo({ event, selectedCategory, pricing, onBack, isSubmitting }: Props) {
  const form = useFormContext<SubmitRegistrationInput>()
  const holders = form.watch('holders')
  const contactWhatsapp = form.watch('contactWhatsapp')

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
            <dd className='font-mono text-xs'>{contactWhatsapp || '—'}</dd>
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
          Transfer ke:{' '}
          <span className='font-medium text-foreground'>{event.bankAccount.bankName}</span> —{' '}
          {event.bankAccount.accountName}{' '}
          <span className='font-mono'>{event.bankAccount.accountNumber}</span>
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

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/public/registration-form/step-two.tsx
git commit -m "feat(registration): add StepTwo summary component"
```

---

## Task 6: Refactor `RegistrationForm` — pakai wizard

**Files:**
- Modify: `src/components/public/registration-form/registration-form.tsx`

- [ ] **Step 1: Ganti seluruh isi file**

Edit `src/components/public/registration-form/registration-form.tsx`:

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

  const handleValidationChange = useCallback(
    (index: number, validation: 'valid' | 'invalid' | 'unknown') => {
      setHolderValidations(prev => {
        if (prev[index] === validation) return prev
        const next = [...prev]
        next[index] = validation
        return next
      })
    },
    [],
  )

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
    const current = form.getValues('holders')
    const next = Array.from(
      { length: qty },
      (_, i) => current[i] ?? { holderName: '', claimedMemberNumber: '', mandatoryMenuItemId: '' },
    )
    replace(next)
    setHolderValidations(prev => Array.from({ length: qty }, (_, i) => prev[i] ?? 'unknown'))
  }

  async function handleNext() {
    const valid = await form.trigger()
    if (valid) setStep(2)
  }

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

  return (
    <FormProvider {...form}>
      <form
        className='mx-auto flex w-full max-w-2xl flex-col gap-6 md:p-6'
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <StepIndicator current={step} />

        <fieldset disabled={!event.registrationOpen || form.formState.isSubmitting} className='min-w-0 space-y-6 border-0 p-0'>
          <legend className='sr-only'>Formulir pendaftaran acara</legend>

          {step === 1 && (
            <StepOne
              event={event}
              fields={fields}
              ticketQty={ticketQty}
              selectedCategoryId={selectedCategoryId}
              holderValidations={holderValidations}
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
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Jalankan semua test**

```bash
pnpm test
```

Expected: semua PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/public/registration-form/registration-form.tsx
git commit -m "feat(registration): refactor RegistrationForm to 2-step wizard"
```

---

## Task 7: Panel halaman konfirmasi

**Files:**
- Create: `src/components/public/registration-form/upload-proof-panel.tsx`
- Create: `src/components/public/registration-form/pending-review-panel.tsx`
- Create: `src/components/public/registration-form/approved-panel.tsx`

- [ ] **Step 1: Buat `UploadProofPanel`**

Buat `src/components/public/registration-form/upload-proof-panel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { FileField } from '@/components/ui/file-field'
import { uploadTransferProof } from '@/lib/actions/upload-transfer-proof'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { formatIdr } from '@/lib/utils/format-idr'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  registrationId: string
  eventTitle: string
  bankName: string
  accountName: string
  accountNumber: string
  totalAmount: number
}

export function UploadProofPanel({
  registrationId,
  eventTitle,
  bankName,
  accountName,
  accountNumber,
  totalAmount,
}: Props) {
  const router = useRouter()
  const [file, setFile] = useState<File | undefined>(undefined)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setIsPending(true)
    const formData = new FormData()
    formData.append('transferProof', file)
    const result = await uploadTransferProof(registrationId, formData)
    setIsPending(false)
    if (result.ok) {
      toastCudSuccess('create', 'Bukti transfer berhasil dikirim.')
      router.refresh()
    } else {
      toastActionErr(result)
    }
  }

  return (
    <main className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 md:px-6'>
      <header className='flex flex-col gap-2'>
        <h1 className='text-2xl font-semibold tracking-tight'>Pendaftaran diterima!</h1>
        <p className='text-sm text-muted-foreground'>
          Selesaikan pembayaran untuk mengkonfirmasi tempatmu di{' '}
          <span className='font-medium text-foreground'>{eventTitle}</span>.
        </p>
      </header>

      <section className='grid gap-2 rounded-lg border bg-card p-4 md:p-6 text-sm'>
        <p className='font-medium'>Transfer ke</p>
        <p>
          <span className='font-semibold'>{bankName}</span> — {accountName}
        </p>
        <p className='font-mono text-base'>{accountNumber}</p>
        <p className='text-lg font-bold tabular-nums'>{formatIdr(totalAmount)}</p>
      </section>

      <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
        <FileField
          id='upload-proof'
          label='Bukti transfer'
          description='Upload screenshot atau foto bukti transfer (JPG, PNG, WebP). Pastikan nominal dan nama penerima terbaca.'
          onChange={setFile}
          pickPrompt='Pilih file bukti transfer'
          replacePrompt='Ganti file'
        />
        <Button type='submit' disabled={!file || isPending} className='w-full min-h-12'>
          {isPending ? 'Mengunggah…' : 'Kirim Bukti Transfer'}
        </Button>
      </form>

      <nav className='flex flex-wrap gap-3 justify-end'>
        <Link href='/' className={cn(buttonVariants({ variant: 'outline' }))}>
          Ke beranda
        </Link>
      </nav>
    </main>
  )
}
```

- [ ] **Step 2: Buat `PendingReviewPanel`**

Buat `src/components/public/registration-form/pending-review-panel.tsx`:

```tsx
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatIdr } from '@/lib/utils/format-idr'

type Props = {
  registrationId: string
  eventTitle: string
  totalAmount: number
}

export function PendingReviewPanel({ registrationId, eventTitle, totalAmount }: Props) {
  return (
    <main className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 md:px-6'>
      <header className='flex flex-col gap-2'>
        <h1 className='text-2xl font-semibold tracking-tight'>Menunggu verifikasi panitia</h1>
        <p className='text-sm text-muted-foreground'>
          Bukti transfer kamu sudah kami terima untuk{' '}
          <span className='font-medium text-foreground'>{eventTitle}</span>. Tim akan memverifikasi
          dalam 1&times;24 jam.
        </p>
      </header>

      <section className='grid gap-3 rounded-lg border bg-card p-4 md:p-6 text-sm'>
        <div className='flex items-start justify-between gap-4'>
          <dt className='text-muted-foreground'>Nomor pemesanan</dt>
          <dd className='max-w-[60%] break-all font-mono text-right text-xs'>{registrationId}</dd>
        </div>
        <div className='flex items-start justify-between gap-4'>
          <dt className='text-muted-foreground'>Total (snapshot)</dt>
          <dd className='font-mono text-base font-semibold tabular-nums'>{formatIdr(totalAmount)}</dd>
        </div>
        <p className='text-xs text-muted-foreground'>
          Simpan halaman ini sebagai bukti pendaftaran sementara.
        </p>
      </section>

      <nav className='flex flex-wrap justify-end gap-3'>
        <Link href='/' className={cn(buttonVariants({ variant: 'outline' }))}>
          Ke beranda
        </Link>
        <Link href='/events' className={cn(buttonVariants({ variant: 'default' }))}>
          Lihat acara lainnya
        </Link>
      </nav>
    </main>
  )
}
```

- [ ] **Step 3: Buat `ApprovedPanel`**

Buat `src/components/public/registration-form/approved-panel.tsx`:

```tsx
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatIdr } from '@/lib/utils/format-idr'

type Props = {
  registrationId: string
  eventTitle: string
  totalAmount: number
}

export function ApprovedPanel({ registrationId, eventTitle, totalAmount }: Props) {
  return (
    <main className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 md:px-6'>
      <header className='flex flex-col gap-2'>
        <h1 className='text-2xl font-semibold tracking-tight'>Selamat, kamu terdaftar!</h1>
        <p className='text-sm text-muted-foreground'>
          Panitia telah mengkonfirmasi pendaftaranmu untuk{' '}
          <span className='font-medium text-foreground'>{eventTitle}</span>. Sampai jumpa di acara!
        </p>
      </header>

      <section className='grid gap-3 rounded-lg border bg-card p-4 md:p-6 text-sm'>
        <div className='flex items-start justify-between gap-4'>
          <dt className='text-muted-foreground'>Acara</dt>
          <dd className='font-medium text-right'>{eventTitle}</dd>
        </div>
        <div className='flex items-start justify-between gap-4'>
          <dt className='text-muted-foreground'>Nomor pemesanan</dt>
          <dd className='max-w-[60%] break-all font-mono text-right text-xs'>{registrationId}</dd>
        </div>
        <div className='flex items-start justify-between gap-4'>
          <dt className='text-muted-foreground'>Total</dt>
          <dd className='font-mono text-base font-semibold tabular-nums'>{formatIdr(totalAmount)}</dd>
        </div>
      </section>

      <nav className='flex flex-wrap justify-end gap-3'>
        <Link href='/' className={cn(buttonVariants({ variant: 'outline' }))}>
          Ke beranda
        </Link>
        <Link href='/events' className={cn(buttonVariants({ variant: 'default' }))}>
          Lihat acara lainnya
        </Link>
      </nav>
    </main>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/public/registration-form/upload-proof-panel.tsx src/components/public/registration-form/pending-review-panel.tsx src/components/public/registration-form/approved-panel.tsx
git commit -m "feat(registration): add confirmation page panels (upload, pending, approved)"
```

---

## Task 8: Update halaman konfirmasi `/register/[registrationId]`

**Files:**
- Modify: `src/app/(public)/events/[slug]/register/[registrationId]/page.tsx`

- [ ] **Step 1: Ganti seluruh isi file**

Edit `src/app/(public)/events/[slug]/register/[registrationId]/page.tsx`:

```tsx
import { RegistrationStatus } from '@prisma/client'
import { RegistrationStatusBadge } from '@/components/admin/registration-status-badge'
import { prisma } from '@/lib/db/prisma'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ApprovedPanel } from '@/components/public/registration-form/approved-panel'
import { PendingReviewPanel } from '@/components/public/registration-form/pending-review-panel'
import { UploadProofPanel } from '@/components/public/registration-form/upload-proof-panel'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Status Pendaftaran',
  robots: { index: false, follow: false },
}

export default async function RegistrationReceiptPage({
  params,
}: {
  params: Promise<{ slug: string; registrationId: string }>
}) {
  const { slug, registrationId } = await params

  const registration = await prisma.registration.findFirst({
    where: {
      id: registrationId,
      event: { slug },
    },
    include: {
      event: {
        include: { bankAccount: true },
      },
    },
  })

  if (!registration) notFound()

  const { status, id, computedTotalAtSubmit, event } = registration

  if (status === RegistrationStatus.submitted) {
    return (
      <UploadProofPanel
        registrationId={id}
        eventTitle={event.title}
        bankName={event.bankAccount.bankName}
        accountName={event.bankAccount.accountName}
        accountNumber={event.bankAccount.accountNumber}
        totalAmount={computedTotalAtSubmit}
      />
    )
  }

  if (status === RegistrationStatus.pending_review) {
    return (
      <PendingReviewPanel
        registrationId={id}
        eventTitle={event.title}
        totalAmount={computedTotalAtSubmit}
      />
    )
  }

  if (status === RegistrationStatus.approved) {
    return (
      <ApprovedPanel
        registrationId={id}
        eventTitle={event.title}
        totalAmount={computedTotalAtSubmit}
      />
    )
  }

  // Fallback: rejected, cancelled, refunded, payment_issue, dll
  return (
    <main className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 md:px-6'>
      <header className='flex flex-wrap items-center gap-3'>
        <h1 className='text-2xl font-semibold tracking-tight'>Status Pendaftaran</h1>
        <RegistrationStatusBadge status={status} />
      </header>
      <p className='text-sm text-muted-foreground'>
        Hubungi panitia untuk informasi lebih lanjut mengenai pendaftaran ini.
      </p>
      <p className='font-mono text-xs text-muted-foreground break-all'>{id}</p>
      <nav className='flex flex-wrap gap-3 justify-end'>
        <Link href='/' className={cn(buttonVariants({ variant: 'outline' }))}>
          Ke beranda
        </Link>
      </nav>
    </main>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Jalankan semua test**

```bash
pnpm test
```

Expected: semua PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/(public)/events/[slug]/register/[registrationId]/page.tsx
git commit -m "feat(registration): make confirmation page status-aware with upload/pending/approved panels"
```

---

## Task 9: Verifikasi manual di dev server

- [ ] **Step 1: Jalankan dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Test happy path**

1. Buka `http://localhost:3000/events/<slug>` untuk sebuah event aktif
2. Verifikasi Step 1 tampil dengan step indicator "1 Data Peserta | 2 Ringkasan & Kirim"
3. Isi data peserta (nama, member/non-member) dan nomor WhatsApp
4. Klik "Lanjut ke Ringkasan →" — verifikasi berpindah ke Step 2 dengan ringkasan yang benar
5. Klik "← Kembali" — verifikasi kembali ke Step 1 dengan data tetap terisi
6. Klik "Lanjut ke Ringkasan →" lagi → Step 2 → klik "Kirim Pendaftaran"
7. Verifikasi redirect ke `/events/<slug>/register/<id>` dengan panel upload
8. Upload sebuah gambar bukti transfer
9. Verifikasi setelah upload: halaman beralih ke panel "Menunggu verifikasi panitia"

- [ ] **Step 3: Test validasi Step 1**

1. Di Step 1, klik "Lanjut ke Ringkasan →" tanpa mengisi nama peserta
2. Verifikasi error validasi muncul inline (tidak pindah ke Step 2)

- [ ] **Step 4: Test halaman konfirmasi langsung**

1. Buka `http://localhost:3000/events/<slug>/register/<id>` dari registration yang `pending_review`
2. Verifikasi tampil panel "Menunggu verifikasi panitia"
3. Di admin, approve registration tersebut
4. Reload halaman — verifikasi tampil panel "Selamat, kamu terdaftar!"
