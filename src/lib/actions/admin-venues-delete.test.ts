import { beforeEach, describe, expect, it, vi } from 'vitest'

const { deleteAllBlobsWithPrefix } = vi.hoisted(() => ({
  deleteAllBlobsWithPrefix: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    venue: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    event: {
      findMany: vi.fn(),
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

vi.mock('@vercel/blob', () => ({
  del: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`MOCK_REDIRECT:${url}`)
  }),
}))

import { del } from '@vercel/blob'
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
    vi.mocked(prisma.event.delete).mockResolvedValue({} as never)
    vi.mocked(prisma.event.findMany).mockResolvedValue([])
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

  it('returns root error when venue has an active event', async () => {
    vi.mocked(prisma.venue.findUnique).mockResolvedValueOnce({ id: 'venue_1', name: 'Venue A' } as never)
    vi.mocked(prisma.event.findMany).mockResolvedValueOnce([
      {
        id: 'ev1',
        title: 'Aktif',
        status: 'active',
        coverBlobUrl: 'https://blob/cover.webp',
        _count: { registrations: 0 },
      },
    ] as never)
    const fd = new FormData()
    fd.set('venueId', 'venue_1')
    const r = await deleteVenue(undefined, fd)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.rootError).toContain('1 acara')
    expect(prisma.venue.delete).not.toHaveBeenCalled()
  })

  it('returns root error when a draft event has registrations', async () => {
    vi.mocked(prisma.venue.findUnique).mockResolvedValueOnce({ id: 'venue_1', name: 'Venue A' } as never)
    vi.mocked(prisma.event.findMany).mockResolvedValueOnce([
      {
        id: 'ev1',
        title: 'Draf isi',
        status: 'draft',
        coverBlobUrl: 'https://blob/cover.webp',
        _count: { registrations: 2 },
      },
    ] as never)
    const fd = new FormData()
    fd.set('venueId', 'venue_1')
    const r = await deleteVenue(undefined, fd)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.rootError).toContain('registrasi')
    expect(prisma.venue.delete).not.toHaveBeenCalled()
  })

  it('deletes draft events, blobs, and venue when only deletable drafts exist', async () => {
    vi.mocked(prisma.venue.findUnique).mockResolvedValueOnce({ id: 'venue_2', name: 'Venue Kosong' } as never)
    vi.mocked(prisma.event.findMany).mockResolvedValueOnce([
      {
        id: 'ev_draft',
        title: 'Draf lama',
        status: 'draft',
        coverBlobUrl: 'https://blob/draft-cover.webp',
        _count: { registrations: 0 },
      },
    ] as never)
    const fd = new FormData()
    fd.set('venueId', 'venue_2')
    await expect(deleteVenue(undefined, fd)).rejects.toThrow('MOCK_REDIRECT:')
    expect(del).toHaveBeenCalledWith('https://blob/draft-cover.webp')
    expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 'ev_draft' } })
    expect(deleteAllBlobsWithPrefix).toHaveBeenCalledWith('venues/venue_2/menu/')
    expect(prisma.venue.delete).toHaveBeenCalledWith({ where: { id: 'venue_2' } })
    expect(redirect).toHaveBeenCalledWith(
      `/admin/venues?tab=all&flash=${encodeURIComponent(ADMIN_VENUES_DELETE_SUCCESS_FLASH)}`,
    )
  })

  it('deletes blobs and venue when no events, then redirects', async () => {
    vi.mocked(prisma.venue.findUnique).mockResolvedValueOnce({ id: 'venue_2', name: 'Venue Kosong' } as never)
    vi.mocked(prisma.event.findMany).mockResolvedValueOnce([])
    const fd = new FormData()
    fd.set('venueId', 'venue_2')
    await expect(deleteVenue(undefined, fd)).rejects.toThrow('MOCK_REDIRECT:')
    expect(prisma.event.delete).not.toHaveBeenCalled()
    expect(deleteAllBlobsWithPrefix).toHaveBeenCalledWith('venues/venue_2/menu/')
    expect(prisma.venue.delete).toHaveBeenCalledWith({ where: { id: 'venue_2' } })
    expect(redirect).toHaveBeenCalledWith(
      `/admin/venues?tab=all&flash=${encodeURIComponent(ADMIN_VENUES_DELETE_SUCCESS_FLASH)}`,
    )
  })
})
