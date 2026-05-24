# Holder Data Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah setting per-event `requireAllHolderData` yang mengontrol apakah setiap tiket harus punya data holder tersendiri, atau cukup data pemesan utama saja untuk semua tiket.

**Architecture:** Field boolean baru di `Event` (default `true` = perilaku lama). Ketika `false`, form publik hanya tampilkan 1 holder card; server action mengkloning data holder utama ke slot 2+ sebelum insert DB, sehingga invariant `ticketQty == holders.count` tetap dipertahankan. Setting dikunci setelah registrasi pertama masuk.

**Tech Stack:** Prisma (schema + migration), Zod (form schema), Next.js Server Actions, React Hook Form (public form), shadcn/ui `Checkbox`

---

## File Map

| File | Tindakan |
|------|----------|
| `prisma/schema.prisma` | Tambah field `requireAllHolderData Boolean @default(true)` ke model `Event` |
| `src/lib/forms/admin-event-form-schema.ts` | Tambah `requireAllHolderData: z.boolean().optional()` |
| `src/lib/actions/admin-events.ts` | Pass field ke create + guard lock + pass ke update |
| `src/lib/actions/__tests__/admin-events.integration.test.ts` | Test lock guard |
| `src/components/admin/forms/event-admin-form.tsx` | Tambah toggle UI di samping `multiCategoryPurchase` |
| `src/app/admin/events/[eventId]/edit/page.tsx` | Tambah ke `defaults` |
| `src/app/admin/events/new/page.tsx` | Tambah ke `defaults` |
| `src/components/public/event-serialization.ts` | Tambah `requireAllHolderData: boolean` ke type |
| `src/lib/events/event-registration-page.ts` | Select + serialize field ke client |
| `src/lib/actions/submit-registration.ts` | Relax guard + kloning holder primary |
| `src/lib/actions/__tests__/submit-registration.integration.test.ts` | Test kloning |
| `src/components/public/registration-form/registration-form.tsx` | Skip holder resize saat primary-only |
| `src/components/public/registration-form/step-one.tsx` | Render hanya 1 holder card saat primary-only |

---

## Task 1: Schema — tambah `requireAllHolderData` ke model Event

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Tambah field ke model Event**

Buka `prisma/schema.prisma`. Cari baris `multiCategoryPurchase    Boolean     @default(false)` (sekitar line 299). Tambah satu baris tepat di bawahnya:

```prisma
  multiCategoryPurchase    Boolean     @default(false)
  requireAllHolderData     Boolean     @default(true)
```

- [ ] **Step 2: Jalankan migrasi dev**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm db:migrate:dev --name add_require_all_holder_data
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verifikasi Prisma client ter-generate**

```bash
grep -r "requireAllHolderData" node_modules/.prisma/client/index.d.ts | head -3
```

Expected: minimal 1 baris output yang menyebut `requireAllHolderData`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add requireAllHolderData to Event model"
```

---

## Task 2: Admin form schema + server action

**Files:**
- Modify: `src/lib/forms/admin-event-form-schema.ts`
- Modify: `src/lib/actions/admin-events.ts`
- Test: `src/lib/actions/__tests__/admin-events.integration.test.ts`

- [ ] **Step 1: Tulis test yang gagal — lock guard**

Buka `src/lib/actions/__tests__/admin-events.integration.test.ts`. Tambah import `updateAdminEvent` di baris import yang sudah ada, dan tambah `describe` block baru di bawah describe block yang ada:

```ts
import { prisma } from '@/lib/db/prisma'
import { createAdminEvent, updateAdminEvent } from '../admin-events'
```

Tambah di akhir file setelah describe block `createAdminEvent`:

```ts
describe('updateAdminEvent — lock guard requireAllHolderData', () => {
  const txEventUpdate = vi.fn()
  const txHelperDeleteMany = vi.fn()
  const txHelperCreateMany = vi.fn()

  beforeEach(() => {
    txEventUpdate.mockReset()
    txHelperDeleteMany.mockReset()
    txHelperCreateMany.mockReset()
    vi.mocked(prisma.adminProfile.findUnique).mockReset()
    vi.mocked(prisma.picBankAccount.findFirst).mockReset()
    vi.mocked(prisma.venueMenuItem.findMany).mockReset()
    vi.mocked(prisma.$transaction).mockReset()
    vi.mocked(prisma.event.findUnique).mockReset()

    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({ id: 'pic-1', role: 'Owner' } as never)
    vi.mocked(prisma.picBankAccount.findFirst).mockResolvedValue({ id: 'bank-1' } as never)
    vi.mocked(prisma.venueMenuItem.findMany).mockResolvedValue([{ id: 'menu-1', venueId: 'venue-1' }] as never)
    txEventUpdate.mockResolvedValue({} as never)
    txHelperDeleteMany.mockResolvedValue({ count: 0 } as never)
    txHelperCreateMany.mockResolvedValue({ count: 0 } as never)
    vi.mocked(prisma.$transaction).mockImplementation(async cb =>
      cb({
        event: { update: txEventUpdate },
        eventVenueMenuItem: { deleteMany: vi.fn(), createMany: vi.fn() },
        eventPicHelper: { deleteMany: txHelperDeleteMany, createMany: txHelperCreateMany },
      } as never),
    )
  })

  const baseExisting = {
    slug: 'acara-uji',
    venueId: 'venue-1',
    coverBlobUrl: 'https://blob.example/old.webp',
    mandatoryMenuItemIds: [],
    picAdminProfileId: 'pic-1',
    bankAccountId: 'bank-1',
    eventVenueMenuItems: [
      {
        venueMenuItemId: 'menu-1',
        sortOrder: 0,
        venueMenuItem: { sortOrder: 0 },
      },
    ],
    helpers: [],
    requireAllHolderData: true,
    _count: { registrations: 1 },
  }

  const basePayload = {
    title: 'Acara Uji',
    summary: 'Ringkasan',
    descriptionHtml: '<p>Isi</p>',
    venueId: 'venue-1',
    linkedVenueMenuItems: [{ venueMenuItemId: 'menu-1', sortOrder: 0 }],
    openRegistrationAtIso: new Date('2026-06-01T08:00:00.000Z').toISOString(),
    closeRegistrationAtIso: new Date('2026-06-10T12:00:00.000Z').toISOString(),
    openGateAtIso: new Date('2026-06-10T16:00:00.000Z').toISOString(),
    kickOffAtIso: new Date('2026-06-10T19:00:00.000Z').toISOString(),
    mandatoryMenuItemIds: [],
    registrationManualClosed: false,
    status: 'active' as const,
    picAdminProfileId: 'pic-1',
    bankAccountId: 'bank-1',
    helperAdminProfileIds: [],
    multiCategoryPurchase: false,
  }

  it('menolak perubahan requireAllHolderData jika sudah ada registrasi', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce(baseExisting as never)

    const fd = new FormData()
    fd.set('payload', JSON.stringify({ ...basePayload, requireAllHolderData: false }))

    const r = await updateAdminEvent('event-1', undefined, fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) {
      expect(r.rootError).toMatch(/tidak dapat diubah/)
    }
  })

  it('mengizinkan perubahan requireAllHolderData jika belum ada registrasi', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce({
      ...baseExisting,
      _count: { registrations: 0 },
    } as never)

    const fd = new FormData()
    fd.set('payload', JSON.stringify({ ...basePayload, requireAllHolderData: false }))

    const r = await updateAdminEvent('event-1', undefined, fd)
    expect(r.ok).toBe(true)
    expect(txEventUpdate).toHaveBeenCalled()
    const call = txEventUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(call.data.requireAllHolderData).toBe(false)
  })
})
```

- [ ] **Step 2: Jalankan test — verifikasi gagal**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/__tests__/admin-events.integration.test.ts
```

Expected: test baru FAIL dengan error seperti `updateAdminEvent is not exported` atau `requireAllHolderData is not a recognized field`.

- [ ] **Step 3: Tambah field ke Zod schema**

Buka `src/lib/forms/admin-event-form-schema.ts`. Cari baris `multiCategoryPurchase: z.boolean().optional(),` (line ~34). Tambah tepat di bawahnya:

```ts
    multiCategoryPurchase: z.boolean().optional(),
    requireAllHolderData: z.boolean().optional(),
```

- [ ] **Step 4: Tambah field ke createAdminEvent dan tambah lock guard + field ke updateAdminEvent**

Buka `src/lib/actions/admin-events.ts`.

**Bagian create** — cari baris `multiCategoryPurchase: data.multiCategoryPurchase ?? false,` (sekitar line 245). Tambah baris di bawahnya:

```ts
          multiCategoryPurchase: data.multiCategoryPurchase ?? false,
          requireAllHolderData: data.requireAllHolderData ?? true,
```

**Bagian update — tambah `requireAllHolderData` ke select query** — cari blok `select` di `prisma.event.findUnique` pada fungsi update (sekitar line 309). Tambah field ke select:

```ts
      _count: { select: { registrations: true } },
      requireAllHolderData: true,
```

**Bagian update — tambah lock guard** — cari blok guard setelah `if (!existing) return rootError('Acara tidak ditemukan.')` (sekitar line 328). Tambah guard baru setelah guard `findMandatoryMenuLockedViolation` yang sudah ada:

```ts
  if (
    existing._count.registrations > 0 &&
    data.requireAllHolderData !== undefined &&
    data.requireAllHolderData !== existing.requireAllHolderData
  ) {
    return rootError('Pengaturan data peserta tidak dapat diubah setelah ada pendaftar.')
  }
```

**Bagian update — tambah ke data update** — cari baris `multiCategoryPurchase: data.multiCategoryPurchase,` (sekitar line 461). Tambah di bawahnya:

```ts
          multiCategoryPurchase: data.multiCategoryPurchase,
          requireAllHolderData: data.requireAllHolderData,
```

- [ ] **Step 5: Jalankan test — verifikasi lulus**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/__tests__/admin-events.integration.test.ts
```

Expected: semua test PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/forms/admin-event-form-schema.ts src/lib/actions/admin-events.ts src/lib/actions/__tests__/admin-events.integration.test.ts
git commit -m "feat(admin): add requireAllHolderData to event schema and update action with lock guard"
```

---

## Task 3: Admin form UI — toggle dan defaults

**Files:**
- Modify: `src/components/admin/forms/event-admin-form.tsx`
- Modify: `src/app/admin/events/[eventId]/edit/page.tsx`
- Modify: `src/app/admin/events/new/page.tsx`

- [ ] **Step 1: Tambah section toggle di event-admin-form.tsx**

Buka `src/components/admin/forms/event-admin-form.tsx`. Cari blok `const sectionMultiCategory` (sekitar line 561). Tambah constant baru tepat **setelah** blok `sectionMultiCategory` (setelah kurung kurawal penutupnya):

```tsx
  const sectionRequireAllHolderData = (
    <section className='space-y-3'>
      <SectionHeading>Data peserta tiket tambahan</SectionHeading>
      <div className='flex items-center gap-2'>
        <Checkbox
          id='requireAllHolderData'
          checked={form.watch('requireAllHolderData') ?? true}
          onCheckedChange={v => form.setValue('requireAllHolderData', Boolean(v))}
          disabled={registrationCount > 0}
        />
        <label htmlFor='requireAllHolderData' className='text-sm'>
          Wajibkan data untuk setiap peserta (nama, nomor member)
        </label>
      </div>
      {registrationCount > 0 && (
        <Muted>Tidak dapat diubah setelah ada pendaftar.</Muted>
      )}
      {!(form.watch('requireAllHolderData') ?? true) && registrationCount === 0 && (
        <Muted>
          Jika dinonaktifkan, hanya data pemesan utama yang dikumpulkan. Tiket tambahan mengikuti
          status keanggotaan pemesan utama.
        </Muted>
      )}
    </section>
  )
```

Kemudian temukan tempat `sectionMultiCategory` dirender di JSX return (cari `{sectionMultiCategory}`). Tambah `{sectionRequireAllHolderData}` tepat di bawahnya:

```tsx
          {sectionMultiCategory}
          {sectionRequireAllHolderData}
```

- [ ] **Step 2: Tambah `requireAllHolderData` ke defaults di edit/page.tsx**

Buka `src/app/admin/events/[eventId]/edit/page.tsx`. Cari baris `multiCategoryPurchase: event.multiCategoryPurchase,` (sekitar line 157). Tambah tepat di bawahnya:

```ts
    multiCategoryPurchase: event.multiCategoryPurchase,
    requireAllHolderData: event.requireAllHolderData,
```

Juga tambah `requireAllHolderData: true` ke select query event. Cari blok `select` atau `include` di `prisma.event.findUnique` pada halaman ini dan tambah:

```ts
      requireAllHolderData: true,
```

- [ ] **Step 3: Tambah `requireAllHolderData` ke defaults di new/page.tsx**

Buka `src/app/admin/events/new/page.tsx`. Cari baris `multiCategoryPurchase: false,` (sekitar line 128). Tambah tepat di bawahnya:

```ts
    multiCategoryPurchase: false,
    requireAllHolderData: true,
```

- [ ] **Step 4: Jalankan type check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm build 2>&1 | grep -E "error TS|Type error" | head -20
```

Expected: tidak ada error TypeScript terkait `requireAllHolderData`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/forms/event-admin-form.tsx src/app/admin/events/[eventId]/edit/page.tsx src/app/admin/events/new/page.tsx
git commit -m "feat(admin): add requireAllHolderData toggle to event editor UI"
```

---

## Task 4: Submit action — relax guard + kloning holder primary

**Files:**
- Modify: `src/lib/actions/submit-registration.ts`
- Test: `src/lib/actions/__tests__/submit-registration.integration.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Buka `src/lib/actions/__tests__/submit-registration.integration.test.ts`. Tambah mock `prisma.registration` yang sudah ada dengan tambahan mock untuk `$transaction`. Ganti isi file dengan versi berikut (preserving existing tests, adding new ones):

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const txRegistrationCreate = vi.fn()
const txRegistrationCount = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    registration: { count: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ registration: { count: txRegistrationCount, create: txRegistrationCreate } }),
    ),
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

const openEvent = {
  id: 'event-1',
  status: 'active',
  registrationManualClosed: false,
  openRegistrationAt: new Date(Date.now() - 1000),
  closeRegistrationAt: new Date(Date.now() + 86400000),
  registrationCapacity: null,
  requireAllHolderData: true,
  ticketCategories: [
    { id: 'cat-1', regularPrice: 100000, memberPrice: 80000, maxQtyPerPerson: null },
  ],
}

describe('submitRegistration (integrasi ringan / tanpa DB nyata)', () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findUnique).mockReset()
    vi.mocked(prisma.registration.count).mockReset()
    txRegistrationCreate.mockReset()
    txRegistrationCount.mockReset()
    vi.mocked(prisma.registration.count).mockResolvedValue(0)
    txRegistrationCount.mockResolvedValue(0)
    txRegistrationCreate.mockResolvedValue({ id: 'reg-1' })
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
    fd.set('holders', JSON.stringify([{ holderName: 'Tester', holderWhatsapp: '+6281234567890' }]))
    fd.set('contactWhatsapp', '+6281234567890')
    const r = await submitRegistration('tidak-ada', fd)
    expect(r.ok).toBe(false)
    if (!r.ok && 'rootError' in r) {
      expect(r.rootError).toBeTruthy()
    }
  })
})

describe('submitRegistration — requireAllHolderData = false (primary-only mode)', () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findUnique).mockReset()
    vi.mocked(prisma.registration.count).mockReset()
    txRegistrationCreate.mockReset()
    txRegistrationCount.mockReset()
    vi.mocked(prisma.registration.count).mockResolvedValue(0)
    txRegistrationCount.mockResolvedValue(0)
    txRegistrationCreate.mockResolvedValue({ id: 'reg-1' })
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...openEvent,
      requireAllHolderData: false,
    } as never)
  })

  it('menerima 1 holder untuk ticketQty=3 dan membuat 3 holder rows di DB', async () => {
    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '3')
    fd.set(
      'holders',
      JSON.stringify([{ holderName: 'Pemesan Utama', holderWhatsapp: '+6281234567890', claimedMemberNumber: '' }]),
    )
    fd.set('contactWhatsapp', '+6281234567890')

    const r = await submitRegistration('event-1', fd)
    expect(r.ok).toBe(true)

    const createCall = txRegistrationCreate.mock.calls[0]![0] as {
      data: { holders: { create: unknown[] } }
    }
    expect(createCall.data.holders.create).toHaveLength(3)
    // semua holder harus punya nama yang sama dengan holder utama
    const rows = createCall.data.holders.create as Array<{ holderName: string }>
    expect(rows[0]!.holderName).toBe('Pemesan Utama')
    expect(rows[1]!.holderName).toBe('Pemesan Utama')
    expect(rows[2]!.holderName).toBe('Pemesan Utama')
  })

  it('menolak jika dikirim lebih dari 1 holder saat primary-only mode', async () => {
    const fd = new FormData()
    fd.set('ticketCategoryId', 'cat-1')
    fd.set('ticketQty', '2')
    fd.set(
      'holders',
      JSON.stringify([
        { holderName: 'Holder 1', holderWhatsapp: '+6281234567890' },
        { holderName: 'Holder 2', holderWhatsapp: '+6281234567891' },
      ]),
    )
    fd.set('contactWhatsapp', '+6281234567890')

    const r = await submitRegistration('event-1', fd)
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Jalankan test — verifikasi gagal**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/__tests__/submit-registration.integration.test.ts
```

Expected: test baru FAIL (holder count mismatch atau holder rows hanya 1).

- [ ] **Step 3: Update submit-registration.ts**

Buka `src/lib/actions/submit-registration.ts`.

**Tambah `requireAllHolderData` ke event select query** — cari blok `select` di `prisma.event.findUnique` (sekitar line 54). Tambah field di antara field yang ada:

```ts
        registrationCapacity: true,
        requireAllHolderData: true,
        ticketCategories: {
```

**Ganti guard holder count dan tambah klon logic** — cari baris (sekitar line 110):

```ts
  if (input.holders.length !== input.ticketQty) {
    return rootError('Jumlah data peserta tidak sesuai dengan jumlah tiket.')
  }
```

Ganti dengan:

```ts
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
```

**Ganti semua pemakaian `input.holders` setelah baris itu dengan `holdersForProcessing`** — cari baris pricing (sekitar line 114):

```ts
  // 5. Compute pricing (server always uses 'unknown' — admin verifies member status)
  const pricing = computeSubmitTotal({
    holders: input.holders.map(h => ({
```

Ganti `input.holders` di sini dan di blok `holders: { create: input.holders.map(...)` pada DB insert (sekitar line 143) dengan `holdersForProcessing`:

```ts
  // 5. Compute pricing
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
```

Dan di bagian DB insert:

```ts
          holders: {
            create: holdersForProcessing.map((h, i) => ({
              sortOrder: i + 1,
              holderName: h.holderName,
              holderWhatsapp: h.holderWhatsapp?.trim() || null,
              claimedMemberNumber: h.claimedMemberNumber?.trim() || null,
              ticketPriceApplied: pricing.lines[i]!.ticketPrice,
              mandatoryMenuItemId: h.mandatoryMenuItemId?.trim() || null,
              mandatoryMenuPriceApplied: null,
            })),
          },
```

- [ ] **Step 4: Jalankan test — verifikasi lulus**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/__tests__/submit-registration.integration.test.ts
```

Expected: semua test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/submit-registration.ts src/lib/actions/__tests__/submit-registration.integration.test.ts
git commit -m "feat(registration): clone primary holder for additional tickets in primary-only mode"
```

---

## Task 5: Event serialization — expose ke public form

**Files:**
- Modify: `src/components/public/event-serialization.ts`
- Modify: `src/lib/events/event-registration-page.ts`

- [ ] **Step 1: Tambah field ke type**

Buka `src/components/public/event-serialization.ts`. Cari `mandatoryMenuItems: SerializedEventMenuItem[]` (baris terakhir di type). Tambah field baru di akhir type `SerializedEventForRegistration`:

```ts
  /** Jika false, form publik hanya tampilkan 1 holder card (pemesan utama). */
  requireAllHolderData: boolean
```

- [ ] **Step 2: Tambah ke query dan return di event-registration-page.ts**

Buka `src/lib/events/event-registration-page.ts`.

Di `getActiveEventRegistrationPageData`, `prisma.event.findFirst` pakai `include` (bukan `select`), jadi semua field Event otomatis termasuk — tidak perlu perubahan di query.

Di return object `getSerializedEventForPublicRegistration` (sekitar line 73), tambah sebelum kurung kurawal penutup:

```ts
      mandatoryMenuItems: flattenedMenuRowsFromEventVenueLinks(event.eventVenueMenuItems).filter(row =>
        event.mandatoryMenuItemIds.includes(row.id),
      ),
      requireAllHolderData: event.requireAllHolderData,
```

- [ ] **Step 3: Jalankan type check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm build 2>&1 | grep -E "error TS|Type error" | head -20
```

Expected: tidak ada error TypeScript. (Jika ada error "Property 'requireAllHolderData' is missing", itu normal sebelum Task 6 — selesaikan Task 6 dulu lalu cek ulang.)

- [ ] **Step 4: Commit**

```bash
git add src/components/public/event-serialization.ts src/lib/events/event-registration-page.ts
git commit -m "feat(public): expose requireAllHolderData to public registration form"
```

---

## Task 6: Public form — sembunyikan holder card 2+ saat primary-only

**Files:**
- Modify: `src/components/public/registration-form/registration-form.tsx`
- Modify: `src/components/public/registration-form/step-one.tsx`

- [ ] **Step 1: Update registration-form.tsx — skip holder resize saat primary-only**

Buka `src/components/public/registration-form/registration-form.tsx`. Cari fungsi `handleQtyChange` (sekitar line 58):

```ts
  function handleQtyChange(qty: number) {
    form.setValue('ticketQty', qty)
    const current = form.getValues('holders')
    const next = Array.from(
      { length: qty },
      (_, i) => current[i] ?? { holderName: '', holderWhatsapp: '', claimedMemberNumber: '', mandatoryMenuItemId: '' },
    )
    replace(next)
    setHolderValidations(prev => Array.from({ length: qty }, (_, i) => prev[i] ?? 'unknown'))
  }
```

Ganti dengan:

```ts
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
    // primary-only: holders array tetap 1 elemen; server akan kloning saat submit
  }
```

- [ ] **Step 2: Update step-one.tsx — render hanya 1 holder card saat primary-only**

Buka `src/components/public/registration-form/step-one.tsx`. Cari blok render holder cards (sekitar line 67):

```tsx
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
```

Ganti dengan:

```tsx
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
```

- [ ] **Step 3: Jalankan full test suite**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm test
```

Expected: semua test PASS.

- [ ] **Step 4: Jalankan build final**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm build
```

Expected: build sukses tanpa error TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/components/public/registration-form/registration-form.tsx src/components/public/registration-form/step-one.tsx
git commit -m "feat(public-form): hide additional holder cards in primary-only mode"
```

---

## Task 7: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Data model section**

Buka `CLAUDE.md`. Cari baris yang menjelaskan model `Event` (berisi `multiCategoryPurchase Boolean`). Tambah `requireAllHolderData` di deskripsi field Event:

Cari teks:
```
`multiCategoryPurchase Boolean` — izinkan beli lintas kategori
```

Tambah setelah baris itu:
```
`requireAllHolderData Boolean` — jika `false`, form publik hanya tampilkan 1 holder card (primary-only mode); server mengkloning data holder utama ke slot 2+ saat submit; dikunci setelah registrasi pertama
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document requireAllHolderData event setting"
```

---

## Verifikasi Akhir

- [ ] Buka dev server dan buka halaman buat acara baru di admin — verifikasi toggle "Data peserta tiket tambahan" muncul di bawah "Pembelian lintas kategori"
- [ ] Buat event dengan `requireAllHolderData = false`, buka halaman registrasi publik, beli 3 tiket — verifikasi hanya 1 holder card yang muncul
- [ ] Submit registrasi tersebut — verifikasi di admin detail registrasi bahwa 3 baris `RegistrationHolder` terbuat dengan data identik
- [ ] Tambahkan 1 registrasi ke event lain yang `requireAllHolderData = true` — verifikasi toggle di-disabled di editor
