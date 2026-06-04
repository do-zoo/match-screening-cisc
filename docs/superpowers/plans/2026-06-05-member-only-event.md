# Member-Only Event Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah `Event.memberAccessMode` (`open` | `tangsel_only` | `cisc_members`) sehingga admin bisa menandai acara khusus member, UI publik menampilkan badge + harga member saja, form menyembunyikan jalur non-member, dan server menolak pendaftaran yang tidak memenuhi syarat.

**Architecture:** Enum Prisma + modul pure `lib/events/member-access-mode.ts` untuk label, eligibility, dan pesan error. Admin: 3 checkbox mutually exclusive di `event-admin-form.tsx`. Ticket categories: sembunyikan `regularPrice` di UI member-only; server sync `regularPrice := memberPrice` saat create/update kategori. Publik: serialisasi `memberAccessMode` ke client; `submitRegistration` validasi holder sebelum transaksi (sebelum kloning jika primary-only).

**Tech Stack:** Prisma migration, Zod, Next.js Server Actions, React Hook Form, Vitest

**Spec:** `docs/superpowers/specs/2026-06-05-member-only-event-design.md`

---

## File Map

| File | Tindakan |
|------|----------|
| `prisma/schema.prisma` | Enum `MemberAccessMode` + field `Event.memberAccessMode` |
| `src/lib/events/member-access-mode.ts` | **Create** — pure helpers + constants |
| `src/lib/events/member-access-mode.test.ts` | **Create** — unit tests |
| `src/lib/forms/admin-event-form-schema.ts` | Tambah `memberAccessMode` |
| `src/lib/actions/admin-events.ts` | Persist field create/update |
| `src/lib/actions/admin-ticket-categories.ts` | Sync `regularPrice` saat event member-only |
| `src/lib/actions/__tests__/admin-events.integration.test.ts` | Test persist mode |
| `src/lib/actions/__tests__/admin-ticket-categories.integration.test.ts` | **Create atau extend** — test sync harga |
| `src/components/admin/forms/event-admin-form.tsx` | Section checkbox + pass mode ke panel kategori |
| `src/app/admin/events/new/page.tsx` | Default `memberAccessMode: 'open'` |
| `src/app/admin/events/[eventId]/edit/page.tsx` | Load `memberAccessMode` ke defaults |
| `src/components/admin/event-editor/ticket-categories-panel.tsx` | Sembunyikan regular price jika member-only |
| `src/components/public/event-serialization.ts` | Tambah `memberAccessMode` ke type |
| `src/lib/events/event-registration-page.ts` | Select + serialize |
| `src/lib/events/public-active-events.ts` | Select mode + badge label; harga card member-only |
| `src/components/public/event-card.tsx` | Prop badge member + tampilan harga member-only |
| `src/app/(public)/events/page.tsx` | Pass props baru ke `EventCard` |
| `src/components/public/home-landing.tsx` | Pass props baru ke `EventCard` |
| `src/components/public/event-summary.tsx` | Badge + harga member-only |
| `src/components/public/registration-form/step-one.tsx` | Banner member-only |
| `src/components/public/registration-form/holder-card.tsx` | Sembunyikan opsi non-member / regional |
| `src/components/public/registration-form/category-picker.tsx` | Harga member-only |
| `src/components/public/registration-form/use-pricing-preview.ts` | Force member pricing jika member-only |
| `src/lib/actions/submit-registration.ts` | Guard eligibility + lookup Tangsel |
| `src/lib/actions/__tests__/submit-registration.integration.test.ts` | Test reject/accept per mode |
| `CLAUDE.md` | Dokumentasi enum + modul |

---

## Task 1: Schema — `MemberAccessMode`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Tambah enum (dekat enum `MemberType`, ~line 40)**

```prisma
enum MemberAccessMode {
  open
  tangsel_only
  cisc_members
}
```

- [ ] **Step 2: Tambah field ke model `Event` (setelah `requireAllHolderData`)**

```prisma
  requireAllHolderData     Boolean           @default(true)
  memberAccessMode         MemberAccessMode  @default(open)
```

- [ ] **Step 3: Migrasi dev**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm db:migrate:dev --name add_event_member_access_mode
```

Expected: migration SQL menambah enum + kolom default `open`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add Event.memberAccessMode enum"
```

---

## Task 2: Core module + unit tests

**Files:**
- Create: `src/lib/events/member-access-mode.ts`
- Create: `src/lib/events/member-access-mode.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  MEMBER_ACCESS_MODE_BADGE,
  assertHolderEligibleForMemberAccessMode,
  isMemberOnlyAccessMode,
} from './member-access-mode'

describe('assertHolderEligibleForMemberAccessMode', () => {
  it('open — always ok', () => {
    expect(assertHolderEligibleForMemberAccessMode({ memberType: undefined }, 'open').ok).toBe(true)
  })

  it('cisc_members — rejects non-member', () => {
    const r = assertHolderEligibleForMemberAccessMode({ memberType: undefined }, 'cisc_members')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('khusus member CISC')
  })

  it('cisc_members — accepts regional', () => {
    expect(assertHolderEligibleForMemberAccessMode({ memberType: 'regional' }, 'cisc_members').ok).toBe(true)
  })

  it('tangsel_only — rejects regional', () => {
    expect(assertHolderEligibleForMemberAccessMode({ memberType: 'regional', claimedMemberNumber: 'R1' }, 'tangsel_only', true).ok).toBe(false)
  })

  it('tangsel_only — accepts tangsel with valid lookup', () => {
    expect(
      assertHolderEligibleForMemberAccessMode({ memberType: 'tangsel', claimedMemberNumber: '123' }, 'tangsel_only', true).ok,
    ).toBe(true)
  })

  it('tangsel_only — rejects tangsel without valid lookup', () => {
    expect(
      assertHolderEligibleForMemberAccessMode({ memberType: 'tangsel', claimedMemberNumber: '123' }, 'tangsel_only', false).ok,
    ).toBe(false)
  })
})

describe('badges', () => {
  it('open has no badge', () => {
    expect(MEMBER_ACCESS_MODE_BADGE.open).toBeNull()
  })
  it('isMemberOnlyAccessMode', () => {
    expect(isMemberOnlyAccessMode('open')).toBe(false)
    expect(isMemberOnlyAccessMode('tangsel_only')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/events/member-access-mode.test.ts
```

- [ ] **Step 3: Implement module**

```ts
import type { MemberAccessMode } from '@prisma/client'

export const MEMBER_ACCESS_MODE_BADGE: Record<MemberAccessMode, string | null> = {
  open: null,
  tangsel_only: 'Khusus member Tangsel',
  cisc_members: 'Khusus member CISC',
}

export const MEMBER_ACCESS_MODE_BANNER: Record<MemberAccessMode, string | null> = {
  open: null,
  tangsel_only: 'Acara ini khusus member CISC Tangsel. Daftar dengan nomor anggota yang terdaftar di direktori.',
  cisc_members: 'Acara ini khusus member CISC. Non-member tidak dapat mendaftar.',
}

export function isMemberOnlyAccessMode(mode: MemberAccessMode): boolean {
  return mode !== 'open'
}

export function allowedMemberTypesForMode(
  mode: MemberAccessMode,
): Array<'tangsel' | 'regional'> | 'all' {
  if (mode === 'open') return 'all'
  if (mode === 'tangsel_only') return ['tangsel']
  return ['tangsel', 'regional']
}

type HolderEligibilityInput = {
  memberType?: 'tangsel' | 'regional' | null
  claimedMemberNumber?: string | null
}

export function assertHolderEligibleForMemberAccessMode(
  holder: HolderEligibilityInput,
  mode: MemberAccessMode,
  tangselLookupValid = false,
): { ok: true } | { ok: false; message: string } {
  if (mode === 'open') return { ok: true }

  if (mode === 'cisc_members') {
    if (!holder.memberType) {
      return { ok: false, message: 'Acara ini khusus member CISC. Pilih status keanggotaan member saat mendaftar.' }
    }
    return { ok: true }
  }

  // tangsel_only
  if (holder.memberType !== 'tangsel' || !holder.claimedMemberNumber?.trim()) {
    return {
      ok: false,
      message: 'Acara ini khusus member CISC Tangsel. Nomor anggota wajib terdaftar di direktori.',
    }
  }
  if (!tangselLookupValid) {
    return {
      ok: false,
      message: 'Acara ini khusus member CISC Tangsel. Nomor anggota wajib terdaftar di direktori.',
    }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm vitest run src/lib/events/member-access-mode.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/member-access-mode.ts src/lib/events/member-access-mode.test.ts
git commit -m "feat: member access mode helpers and unit tests"
```

---

## Task 3: Admin schema + server actions (event)

**Files:**
- Modify: `src/lib/forms/admin-event-form-schema.ts`
- Modify: `src/lib/actions/admin-events.ts`
- Modify: `src/app/admin/events/new/page.tsx`
- Modify: `src/app/admin/events/[eventId]/edit/page.tsx`

- [ ] **Step 1: Zod — import enum + field**

Di `admin-event-form-schema.ts`:

```ts
import { EventStatus, MemberAccessMode } from '@prisma/client'

// inside adminEventUpsertSchema object:
memberAccessMode: z.nativeEnum(MemberAccessMode).optional(),
```

- [ ] **Step 2: `createAdminEvent` — persist field**

Di `admin-events.ts` create data block (~line 245):

```ts
memberAccessMode: data.memberAccessMode ?? MemberAccessMode.open,
```

Tambah import `MemberAccessMode` from `@prisma/client`.

- [ ] **Step 3: `updateAdminEvent` — select + persist**

Tambah `memberAccessMode: true` ke select `existing` jika belum ada, dan di `tx.event.update` data:

```ts
memberAccessMode: data.memberAccessMode ?? existing.memberAccessMode,
```

- [ ] **Step 4: Page defaults**

`new/page.tsx` defaults:

```ts
memberAccessMode: 'open' as const,
```

`edit/page.tsx` defaults:

```ts
memberAccessMode: event.memberAccessMode,
```

- [ ] **Step 5: Integration test — persist mode**

Di `admin-events.integration.test.ts`, tambah test:

```ts
it('menyimpan memberAccessMode tangsel_only', async () => {
  // mock prisma seperti test requireAllHolderData existing
  const fd = new FormData()
  fd.set('payload', JSON.stringify({ ...basePayload, memberAccessMode: 'tangsel_only' }))
  const res = await updateAdminEvent('evt-1', undefined, fd)
  expect(res.ok).toBe(true)
  expect(prisma.event.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ memberAccessMode: 'tangsel_only' }),
    }),
  )
})
```

- [ ] **Step 6: Run test**

```bash
pnpm vitest run src/lib/actions/__tests__/admin-events.integration.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/forms/admin-event-form-schema.ts src/lib/actions/admin-events.ts src/app/admin/events/
git commit -m "feat(admin): persist Event.memberAccessMode on create/update"
```

---

## Task 4: Admin UI — checkbox akses pendaftaran

**Files:**
- Modify: `src/components/admin/forms/event-admin-form.tsx`

- [ ] **Step 1: Import `MemberAccessMode` + constants**

- [ ] **Step 2: Tambah section setelah `sectionRequireAllHolderData`**

```tsx
const memberAccessMode = form.watch('memberAccessMode') ?? 'open'

const sectionMemberAccess = (
  <section className='space-y-3'>
    <SectionHeading>Akses pendaftaran</SectionHeading>
    {(
      [
        ['open', 'Acara umum'],
        ['tangsel_only', 'Hanya member CISC Tangsel'],
        ['cisc_members', 'Hanya member CISC (Tangsel + regional)'],
      ] as const
    ).map(([value, label]) => (
      <div key={value} className='flex items-center gap-2'>
        <Checkbox
          id={`memberAccessMode-${value}`}
          checked={memberAccessMode === value}
          onCheckedChange={checked => {
            if (checked) form.setValue('memberAccessMode', value, { shouldDirty: true })
          }}
        />
        <label htmlFor={`memberAccessMode-${value}`} className='text-sm'>
          {label}
        </label>
      </div>
    ))}
  </section>
)
```

Render `{sectionMemberAccess}` di layout form dekat section multi-kategori / requireAllHolderData.

- [ ] **Step 3: Pass `memberAccessMode` ke `TicketCategoriesPanel`**

```tsx
<TicketCategoriesPanel
  eventId={props.eventId ?? ''}
  categories={props.categories}
  memberAccessMode={memberAccessMode}
/>
```

- [ ] **Step 4: Manual smoke** — buka `/admin/events/new`, centang mode, submit payload di devtools Network (opsional).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/forms/event-admin-form.tsx
git commit -m "feat(admin): member access mode checkbox group in event editor"
```

---

## Task 5: Ticket categories — harga member-only

**Files:**
- Modify: `src/components/admin/event-editor/ticket-categories-panel.tsx`
- Modify: `src/lib/actions/admin-ticket-categories.ts`

- [ ] **Step 1: Panel prop + hide regular price**

```tsx
import type { MemberAccessMode } from '@prisma/client'
import { isMemberOnlyAccessMode } from '@/lib/events/member-access-mode'

export function TicketCategoriesPanel({
  eventId,
  categories: initialCategories,
  memberAccessMode = 'open',
}: {
  eventId: string
  categories: EventTicketCategoryRow[]
  memberAccessMode?: MemberAccessMode
}) {
  const memberOnly = isMemberOnlyAccessMode(memberAccessMode)
  // di dialog form: render IdrAmountInput regularPrice hanya jika !memberOnly
  // di tabel: kolom reguler hidden jika memberOnly
```

Saat submit dialog jika `memberOnly`:

```ts
const payload = memberOnly ? { ...values, regularPrice: values.memberPrice } : values
```

- [ ] **Step 2: Server sync di `createTicketCategory`**

Setelah parse, load event:

```ts
const event = await prisma.event.findUnique({
  where: { id: eventId },
  select: { memberAccessMode: true },
})
if (!event) return rootError('Acara tidak ditemukan.')

const prices =
  event.memberAccessMode !== 'open'
    ? { regularPrice: parsed.data.memberPrice, memberPrice: parsed.data.memberPrice }
    : { regularPrice: parsed.data.regularPrice, memberPrice: parsed.data.memberPrice }

const category = await prisma.eventTicketCategory.create({
  data: { eventId, ...parsed.data, ...prices, capacity: parsed.data.capacity ?? null, sortOrder },
  select: { id: true },
})
```

- [ ] **Step 3: Same sync di `updateTicketCategory`** (when not priceLocked)

- [ ] **Step 4: Integration test sync**

Mock event `memberAccessMode: 'cisc_members'`, create category `memberPrice: 50000`, expect DB data `regularPrice: 50000`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/event-editor/ticket-categories-panel.tsx src/lib/actions/admin-ticket-categories.ts
git commit -m "feat(admin): member-only ticket categories show member price only"
```

---

## Task 6: Public serialization + listing

**Files:**
- Modify: `src/components/public/event-serialization.ts`
- Modify: `src/lib/events/event-registration-page.ts`
- Modify: `src/lib/events/public-active-events.ts`
- Modify: `src/components/public/event-card.tsx`
- Modify: `src/app/(public)/events/page.tsx`
- Modify: `src/components/public/home-landing.tsx`
- Modify: `src/components/public/event-summary.tsx`

- [ ] **Step 1: Type + serialize**

`event-serialization.ts`:

```ts
import type { MemberAccessMode } from '@prisma/client'

export type SerializedEventForRegistration = {
  // ...existing
  memberAccessMode: MemberAccessMode
}
```

`event-registration-page.ts`: select `memberAccessMode: true`, pass through.

- [ ] **Step 2: `PublicActiveEventRow` — tambah fields**

```ts
memberAccessMode: MemberAccessMode
memberAccessBadge: string | null
```

Select `memberAccessMode` in query; map badge via `MEMBER_ACCESS_MODE_BADGE`.

- [ ] **Step 3: `EventCard` — badge + pricing**

Props baru: `memberAccessBadge?: string | null`, `memberOnlyPricing?: boolean`

- Jika `memberAccessBadge`, render pill di samping status badge
- Jika `memberOnlyPricing`, hanya tampilkan `lowestMemberPrice` (sembunyikan regular)

- [ ] **Step 4: Pass props dari `home-landing.tsx` dan `events/page.tsx`**

```tsx
memberAccessBadge={e.memberAccessBadge}
memberOnlyPricing={e.memberAccessMode !== 'open'}
```

- [ ] **Step 5: `event-summary.tsx`**

Import `isMemberOnlyAccessMode`, `MEMBER_ACCESS_MODE_BADGE`. Tampilkan badge + harga hanya member + catatan spec.

- [ ] **Step 6: Commit**

```bash
git add src/components/public/ src/lib/events/event-registration-page.ts src/lib/events/public-active-events.ts
git commit -m "feat(public): badge and member-only pricing on event cards and summary"
```

---

## Task 7: Registration form UI

**Files:**
- Modify: `src/components/public/registration-form/step-one.tsx`
- Modify: `src/components/public/registration-form/holder-card.tsx`
- Modify: `src/components/public/registration-form/category-picker.tsx`
- Modify: `src/components/public/registration-form/use-pricing-preview.ts`

- [ ] **Step 1: Banner di `step-one.tsx`**

```tsx
import { MEMBER_ACCESS_MODE_BANNER } from '@/lib/events/member-access-mode'

const banner = MEMBER_ACCESS_MODE_BANNER[event.memberAccessMode]
{banner ? <Alert>{banner}</Alert> : null}
```

- [ ] **Step 2: `holder-card.tsx` — prop `memberAccessMode`**

Pass from `step-one.tsx`. Logic:

```tsx
const allowed = allowedMemberTypesForMode(memberAccessMode)
const showNonMember = allowed === 'all'
const showRegional = allowed === 'all' || allowed.includes('regional')
const showTangsel = allowed === 'all' || allowed.includes('tangsel')

// useEffect: if tangsel_only, setMemberType('tangsel') on mount
```

Render radio items conditionally.

- [ ] **Step 3: `category-picker.tsx`**

Prop `memberOnly?: boolean` — jika true, tampilkan hanya `formatIdr(cat.memberPrice)` tanpa reguler.

- [ ] **Step 4: `use-pricing-preview.ts`**

Jika `event.memberAccessMode !== 'open'`, pass `memberValidation: 'valid'` ke preview lines (harga member).

- [ ] **Step 5: Commit**

```bash
git add src/components/public/registration-form/
git commit -m "feat(public): member-only registration form UI constraints"
```

---

## Task 8: Server guard — `submitRegistration`

**Files:**
- Modify: `src/lib/actions/submit-registration.ts`
- Modify: `src/lib/actions/__tests__/submit-registration.integration.test.ts`

- [ ] **Step 1: Select `memberAccessMode` + `requireAllHolderData` on event fetch**

- [ ] **Step 2: Helper async validate holders BEFORE cloning**

```ts
import { assertHolderEligibleForMemberAccessMode } from '@/lib/events/member-access-mode'

async function validateMemberAccessHolders(
  mode: MemberAccessMode,
  holders: HolderInput[],
  requireAll: boolean,
  eventId: string,
): Promise<ActionResult<void>> {
  if (mode === 'open') return ok(undefined)

  const toCheck = requireAll ? holders : [holders[0]!]

  for (const h of toCheck) {
    let tangselValid = false
    if (mode === 'tangsel_only' && h.memberType === 'tangsel' && h.claimedMemberNumber?.trim()) {
      const lookup = await lookupMemberForRegistration(h.claimedMemberNumber, eventId)
      tangselValid = lookup.status === 'valid'
    }
    const r = assertHolderEligibleForMemberAccessMode(h, mode, tangselValid)
    if (!r.ok) return rootError(r.message)
  }
  return ok(undefined)
}
```

Panggil setelah holder count validation (~line 133), **sebelum** `holdersForProcessing` cloning.

- [ ] **Step 3: Integration tests**

```ts
describe('submitRegistration — memberAccessMode', () => {
  it('menolak non-member pada cisc_members', async () => {
    mockEvent({ memberAccessMode: 'cisc_members' })
    const fd = buildFormData({ holders: [{ ...nonMemberHolder }] })
    const res = await submitRegistration('evt-1', fd)
    expect(res.ok).toBe(false)
  })

  it('menolak regional pada tangsel_only', async () => {
    mockEvent({ memberAccessMode: 'tangsel_only' })
    const fd = buildFormData({ holders: [{ memberType: 'regional', claimedMemberNumber: 'X', ... }] })
    expect((await submitRegistration('evt-1', fd)).ok).toBe(false)
  })

  it('menerima tangsel valid pada tangsel_only', async () => {
    mockEvent({ memberAccessMode: 'tangsel_only' })
    mockLookupValid()
    const fd = buildFormData({ holders: [{ memberType: 'tangsel', claimedMemberNumber: '001', ... }] })
    expect((await submitRegistration('evt-1', fd)).ok).toBe(true)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/lib/actions/__tests__/submit-registration.integration.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/submit-registration.ts src/lib/actions/__tests__/submit-registration.integration.test.ts
git commit -m "feat: enforce member access mode on registration submit"
```

---

## Task 9: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Data model** — tambah enum `MemberAccessMode` dan field `Event.memberAccessMode` dengan penjelasan 3 mode.

- [ ] **Step 2: Key library modules** — entri `lib/events/member-access-mode.ts`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document MemberAccessMode and member-only events"
```

---

## Task 10: Final verification

- [ ] **Step 1: Lint**

```bash
pnpm lint
```

- [ ] **Step 2: Full test suite**

```bash
pnpm test
```

- [ ] **Step 3: Manual checklist**

1. Admin: buat acara `tangsel_only`, hanya field harga member di kategori
2. Publik: kartu acara tampil badge + harga member saja
3. Form: tidak ada opsi Non-Member; submit tanpa nomor valid → toast error Indonesia
4. Admin: ubah ke `open` — opsi non-member kembali

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|------------------|------|
| Enum + default open | Task 1 |
| 3 checkbox admin | Task 4 |
| No lock after registrant | Task 3 (no guard added) |
| Admin member price only | Task 5 |
| Public badge + listing | Task 6 |
| Public member price only | Task 6, 7 |
| Form banner + hide non-member | Task 7 |
| Multi-ticket rules | Task 8 (validate before clone) |
| submitRegistration guard | Task 8 |
| lib module + tests | Task 2 |
| CLAUDE.md | Task 9 |
