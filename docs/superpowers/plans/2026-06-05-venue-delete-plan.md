# Hapus venue (hard delete) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah hard delete venue tanpa acara terhubung, dengan zona berbahaya di halaman edit, cleanup blob menu, dan toast sukses setelah redirect ke indeks.

**Architecture:** Server action `deleteVenue` di `admin-venues.ts` mirror `deleteAdminEvent` (guard operasional, blokir `eventCount > 0`, prefix blob delete, `prisma.venue.delete`, redirect + flash). UI `VenueDeletePanel` mirror `EventDeletePanel`. Flash handler baru di layout `admin/venues`.

**Tech Stack:** Next.js App Router, Prisma, Vercel Blob (`deleteAllBlobsWithPrefix`), Vitest, `@base-ui/react` Dialog.

**Spec:** [`docs/superpowers/specs/2026-06-05-venue-delete-design.md`](../specs/2026-06-05-venue-delete-design.md)

---

## File map

| File | Tanggung jawab |
| ---- | -------------- |
| `src/lib/actions/admin-venues.ts` | `deleteVenue` server action |
| `src/lib/actions/admin-venues-delete.test.ts` | Unit tests `deleteVenue` (mock terpisah dari `admin-venues.test.ts`) |
| `src/lib/admin/admin-venues-delete-flash.ts` | Konstanta `ADMIN_VENUES_DELETE_SUCCESS_FLASH` |
| `src/components/admin/admin-venues-index-flash-handler.tsx` | Toast sukses pasca-redirect |
| `src/app/admin/venues/layout.tsx` | Mount flash handler dalam `Suspense` |
| `src/components/admin/venue-delete-panel.tsx` | Zona berbahaya + dialog konfirmasi |
| `src/app/admin/venues/[venueId]/edit/page.tsx` | Wire panel + query `eventCount` |
| `CLAUDE.md` | Route layout, modul, komponen |

---

### Task 1: `deleteVenue` server action (TDD)

**Files:**
- Modify: `src/lib/actions/admin-venues.ts`
- Create: `src/lib/actions/admin-venues-delete.test.ts`

- [ ] **Step 1: Write failing test file**

```ts
// src/lib/actions/admin-venues-delete.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteAllBlobsWithPrefix = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    venue: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/actions/guard', () => ({
  guardOwnerOrAdmin: vi.fn().mockResolvedValue({
    profileId: 'actor_prof',
    role: 'Admin',
    helperEventIds: [],
    authUserId: 'actor_user',
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/uploads/delete-blobs-by-prefix', () => ({
  deleteAllBlobsWithPrefix,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`MOCK_REDIRECT:${url}`)
  }),
}))

import { redirect } from 'next/navigation'
import { guardOwnerOrAdmin, isAuthError } from '@/lib/actions/guard'
import { deleteVenue } from '@/lib/actions/admin-venues'
import { ADMIN_VENUES_DELETE_SUCCESS_FLASH } from '@/lib/admin/admin-venues-delete-flash'
import { prisma } from '@/lib/db/prisma'

describe('deleteVenue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(guardOwnerOrAdmin).mockResolvedValue({
      profileId: 'actor_prof',
      role: 'Admin',
      helperEventIds: [],
      authUserId: 'actor_user',
    })
    vi.mocked(isAuthError).mockReturnValue(false)
    deleteAllBlobsWithPrefix.mockResolvedValue(2)
    vi.mocked(prisma.venue.delete).mockResolvedValue({} as never)
  })

  it('returns root error when not authorized', async () => {
    vi.mocked(guardOwnerOrAdmin).mockRejectedValueOnce('FORBIDDEN')
    vi.mocked(isAuthError).mockReturnValueOnce(true)
    const fd = new FormData()
    fd.set('venueId', 'venue_1')
    const r = await deleteVenue(undefined, fd)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.rootError).toBe('Tidak diizinkan.')
  })

  it('returns root error when venueId is empty', async () => {
    const fd = new FormData()
    fd.set('venueId', '  ')
    const r = await deleteVenue(undefined, fd)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.rootError).toContain('tidak valid')
  })

  it('returns root error when venue not found', async () => {
    vi.mocked(prisma.venue.findUnique).mockResolvedValueOnce(null)
    const fd = new FormData()
    fd.set('venueId', 'missing')
    const r = await deleteVenue(undefined, fd)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.rootError).toContain('tidak ditemukan')
  })

  it('returns root error when venue has events', async () => {
    vi.mocked(prisma.venue.findUnique).mockResolvedValueOnce({
      id: 'venue_1',
      name: 'Venue A',
      _count: { events: 2 },
    } as never)
    const fd = new FormData()
    fd.set('venueId', 'venue_1')
    const r = await deleteVenue(undefined, fd)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.rootError).toContain('2')
    expect(prisma.venue.delete).not.toHaveBeenCalled()
  })

  it('deletes blobs and venue when no events, then redirects', async () => {
    vi.mocked(prisma.venue.findUnique).mockResolvedValueOnce({
      id: 'venue_2',
      name: 'Venue Kosong',
      _count: { events: 0 },
    } as never)
    const fd = new FormData()
    fd.set('venueId', 'venue_2')
    await expect(deleteVenue(undefined, fd)).rejects.toThrow('MOCK_REDIRECT:')
    expect(deleteAllBlobsWithPrefix).toHaveBeenCalledWith('venues/venue_2/menu/')
    expect(prisma.venue.delete).toHaveBeenCalledWith({ where: { id: 'venue_2' } })
    expect(redirect).toHaveBeenCalledWith(
      `/admin/venues?tab=all&flash=${encodeURIComponent(ADMIN_VENUES_DELETE_SUCCESS_FLASH)}`,
    )
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/admin-venues-delete.test.ts
```

Expected: FAIL — `deleteVenue` / `ADMIN_VENUES_DELETE_SUCCESS_FLASH` not exported.

- [ ] **Step 3: Add flash constant**

```ts
// src/lib/admin/admin-venues-delete-flash.ts
/** Nilai query `flash` setelah redirect sukses dari `deleteVenue`. */
export const ADMIN_VENUES_DELETE_SUCCESS_FLASH = 'hapus-venue'
```

- [ ] **Step 4: Implement `deleteVenue`**

Tambahkan di `src/lib/actions/admin-venues.ts` (imports + function di akhir file):

```ts
import { ADMIN_VENUES_DELETE_SUCCESS_FLASH } from '@/lib/admin/admin-venues-delete-flash'
import { deleteAllBlobsWithPrefix } from '@/lib/uploads/delete-blobs-by-prefix'

export async function deleteVenue(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const venueId = formData.get('venueId')
  if (!venueId || typeof venueId !== 'string' || venueId.trim() === '') {
    return rootError('ID venue tidak valid.')
  }

  const id = venueId.trim()

  const venue = await prisma.venue.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { events: true } },
    },
  })

  if (!venue) return rootError('Venue tidak ditemukan.')

  if (venue._count.events > 0) {
    return rootError(`Venue tidak bisa dihapus karena digunakan oleh ${venue._count.events} acara.`)
  }

  await deleteAllBlobsWithPrefix(`venues/${id}/menu/`).catch(() => undefined)

  try {
    await prisma.venue.delete({ where: { id: venue.id } })
  } catch {
    return rootError('Gagal menghapus venue. Coba lagi atau periksa apakah venue baru dipakai acara.')
  }

  revalidatePath('/admin/venues')
  revalidatePath(`/admin/venues/${id}/edit`)

  redirect(`/admin/venues?tab=all&flash=${encodeURIComponent(ADMIN_VENUES_DELETE_SUCCESS_FLASH)}`)
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/admin-venues-delete.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/admin-venues-delete-flash.ts src/lib/actions/admin-venues.ts src/lib/actions/admin-venues-delete.test.ts
git commit -m "$(cat <<'EOF'
feat(venues): add deleteVenue server action with tests

Hard-delete venues with no linked events, clean up menu blobs, and
redirect to the venues index with a success flash query param.
EOF
)"
```

---

### Task 2: Flash toast infrastructure

**Files:**
- Create: `src/components/admin/admin-venues-index-flash-handler.tsx`
- Create: `src/app/admin/venues/layout.tsx`

- [ ] **Step 1: Create flash handler**

```tsx
// src/components/admin/admin-venues-index-flash-handler.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { ADMIN_VENUES_DELETE_SUCCESS_FLASH } from '@/lib/admin/admin-venues-delete-flash'
import { toastCudSuccess } from '@/lib/client/cud-notify'

export function AdminVenuesIndexFlashHandler() {
  const sp = useSearchParams()
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    if (sp.get('flash') !== ADMIN_VENUES_DELETE_SUCCESS_FLASH) return
    fired.current = true
    toastCudSuccess('delete', 'Venue berhasil dihapus.')
    const next = new URLSearchParams(sp.toString())
    next.delete('flash')
    const qs = next.toString()
    router.replace(qs ? `/admin/venues?${qs}` : '/admin/venues?tab=all')
  }, [sp, router])

  return null
}
```

- [ ] **Step 2: Create venues layout**

```tsx
// src/app/admin/venues/layout.tsx
import { Suspense } from 'react'

import { AdminVenuesIndexFlashHandler } from '@/components/admin/admin-venues-index-flash-handler'

export default function AdminVenuesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Suspense fallback={null}>
        <AdminVenuesIndexFlashHandler />
      </Suspense>
      {children}
    </>
  )
}
```

- [ ] **Step 3: Run lint on new files**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/admin-venues-index-flash-handler.tsx src/app/admin/venues/layout.tsx
git commit -m "$(cat <<'EOF'
feat(venues): flash toast after successful venue delete

Show a success toast on the venues index when redirected with the
hapus-venue flash query param.
EOF
)"
```

---

### Task 3: `VenueDeletePanel` + halaman edit

**Files:**
- Create: `src/components/admin/venue-delete-panel.tsx`
- Modify: `src/app/admin/venues/[venueId]/edit/page.tsx`

- [ ] **Step 1: Create panel component**

```tsx
// src/components/admin/venue-delete-panel.tsx
'use client'

import { useActionState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { deleteVenue } from '@/lib/actions/admin-venues'
import { toastActionErr } from '@/lib/client/cud-notify'
import type { ActionResult } from '@/lib/forms/action-result'

type Props = {
  venueId: string
  venueName: string
  eventCount: number
}

export function VenueDeletePanel({ venueId, venueName, eventCount }: Props) {
  const [state, dispatch, isPending] = useActionState(deleteVenue, null as ActionResult<{ deleted: true }> | null)

  useEffect(() => {
    if (state?.ok === false) toastActionErr(state)
  }, [state])

  return (
    <section className='flex flex-col gap-4 rounded-lg border border-destructive/40 p-4 md:p-6'>
      <div>
        <h2 className='text-base font-semibold text-destructive'>Zona berbahaya</h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Tindakan di bawah ini bersifat permanen dan tidak bisa dibatalkan.
        </p>
      </div>

      {eventCount > 0 ? (
        <p className='text-sm text-muted-foreground'>
          Venue tidak bisa dihapus karena digunakan oleh <strong>{eventCount} acara</strong>. Hapus atau ubah venue pada
          acara terkait terlebih dahulu jika ingin menghapus venue ini.
        </p>
      ) : (
        <Dialog>
          <DialogTrigger disabled={isPending} render={<Button variant='destructive' className='w-fit' />}>
            Hapus venue
          </DialogTrigger>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>Hapus venue</DialogTitle>
              <DialogDescription>
                Menghapus <strong>{venueName}</strong> secara permanen beserta semua item menu kanoniknya. Tindakan ini
                tidak bisa dibatalkan.
              </DialogDescription>
            </DialogHeader>
            {state?.ok === false && state.rootError ? (
              <Alert variant='destructive'>
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{state.rootError}</AlertDescription>
              </Alert>
            ) : null}
            <form action={dispatch}>
              <input type='hidden' name='venueId' value={venueId} />
              <DialogFooter>
                <Button type='submit' variant='destructive' disabled={isPending}>
                  {isPending ? <Loader2 className='size-4 animate-spin' /> : 'Ya, hapus venue'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Wire di halaman edit**

Modify `src/app/admin/venues/[venueId]/edit/page.tsx`:

1. Import `VenueDeletePanel`
2. Extend `prisma.venue.findUnique` select:

```ts
select: {
  id: true,
  name: true,
  address: true,
  mapUrl: true,
  updatedAt: true,
  _count: { select: { events: true } },
},
```

3. Tambahkan panel di bawah `VenueBasicsForm`:

```tsx
<VenueDeletePanel
  venueId={venue.id}
  venueName={venue.name}
  eventCount={venue._count.events}
/>
```

- [ ] **Step 3: Run lint**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/venue-delete-panel.tsx src/app/admin/venues/[venueId]/edit/page.tsx
git commit -m "$(cat <<'EOF'
feat(venues): danger-zone delete panel on venue edit page

Mirror the event delete UX: block when events exist, confirm via
dialog, and submit to deleteVenue.
EOF
)"
```

---

### Task 4: Dokumentasi `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Route layout**

Di bagian `admin/venues/`, tambahkan bullet:

```markdown
- `admin/venues/layout.tsx` — flash toast sukses hapus venue (`AdminVenuesIndexFlashHandler`, `?flash=hapus-venue`)
```

- [ ] **Step 2: Update Key library modules**

Tambahkan entri:

```markdown
- `lib/admin/admin-venues-delete-flash.ts` — `ADMIN_VENUES_DELETE_SUCCESS_FLASH` untuk redirect pasca-`deleteVenue`
```

Di entri `lib/actions/admin-venues.ts` (atau tambah jika belum ada), sebutkan `deleteVenue`.

- [ ] **Step 3: Update UI components**

Tambahkan:

```markdown
- `venue-delete-panel.tsx` — zona berbahaya hapus venue di halaman edit (`VenueDeletePanel`)
- `admin-venues-index-flash-handler.tsx` — toast sukses hapus venue di indeks
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: document venue delete flow in CLAUDE.md

Record the new layout flash handler, deleteVenue action, and UI panel.
EOF
)"
```

---

### Task 5: Verifikasi akhir

- [ ] **Step 1: Run full test suite for touched modules**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/actions/admin-venues-delete.test.ts src/lib/actions/admin-venues.test.ts
```

Expected: semua PASS.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no errors on changed files.

---

## Manual test plan

1. Login sebagai Owner atau Admin.
2. Buat venue baru (tanpa acara) → buka halaman edit → zona berbahaya menampilkan tombol "Hapus venue".
3. Konfirmasi hapus → redirect ke `/admin/venues?tab=all&flash=hapus-venue` → toast "Venue berhasil dihapus."
4. Venue hilang dari indeks.
5. Buat venue + acara yang memakai venue tersebut → halaman edit venue menampilkan pesan blokir (tanpa tombol), menyebut jumlah acara.
6. Verifier/Viewer: `/admin/venues` tetap `notFound` (unchanged).
