import { beforeEach, describe, expect, it, vi } from 'vitest'

const txVenueFindUnique = vi.fn()
const txVenueUpdate = vi.fn()
const txVenueMenuItemFindMany = vi.fn()
const txVenueMenuItemUpdate = vi.fn()
const txVenueMenuItemDelete = vi.fn()
const txVenueMenuItemCreate = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    eventVenueMenuItem: { findMany: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        venue: {
          findUnique: txVenueFindUnique,
          update: txVenueUpdate,
        },
        venueMenuItem: {
          findMany: txVenueMenuItemFindMany,
          update: txVenueMenuItemUpdate,
          delete: txVenueMenuItemDelete,
          create: txVenueMenuItemCreate,
        },
      }),
    ),
  },
}))

vi.mock('@/lib/actions/guard', () => ({
  guardOwnerOrAdmin: vi.fn().mockResolvedValue({
    profileId: 'actor_prof',
    role: 'Owner',
    helperEventIds: [],
    authUserId: 'actor_user',
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@vercel/blob', () => ({ del: vi.fn().mockResolvedValue(undefined) }))

import { prisma } from '@/lib/db/prisma'
import { saveVenueCatalog } from '@/lib/actions/admin-venues'

describe('saveVenueCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.eventVenueMenuItem.findMany).mockResolvedValue([{ venueMenuItemId: 'menu_1' }] as never)
    txVenueFindUnique.mockResolvedValue({ id: 'venue_1' })
    txVenueMenuItemFindMany.mockResolvedValue([
      {
        id: 'menu_1',
        name: 'Kopi Susu Gula Aren',
        price: 28000,
        description: 'Versi lama',
        imageBlobUrl: 'https://blob/old.webp',
        imageBlobPath: 'venues/venue_1/menu/menu_1.webp',
      },
    ])
    txVenueUpdate.mockResolvedValue({})
    txVenueMenuItemUpdate.mockResolvedValue({})
    txVenueMenuItemDelete.mockResolvedValue({})
    txVenueMenuItemCreate.mockResolvedValue({})
  })

  it('allows description and image metadata edits for frozen menu items', async () => {
    const formData = new FormData()
    formData.set(
      'payload',
      JSON.stringify({
        name: 'Venue A',
        address: 'Jl. Venue',
        items: [
          {
            id: 'menu_1',
            name: 'Kopi Susu Gula Aren',
            price: 28000,
            sortOrder: 1,
            description: 'Espresso susu dengan gula aren.',
            imageBlobUrl: 'https://blob/old.webp',
            imageBlobPath: 'venues/venue_1/menu/menu_1.webp',
          },
        ],
      }),
    )

    const result = await saveVenueCatalog('venue_1', formData)

    expect(result.ok).toBe(true)
    expect(txVenueMenuItemUpdate).toHaveBeenCalledWith({
      where: { id: 'menu_1' },
      data: expect.objectContaining({
        name: 'Kopi Susu Gula Aren',
        price: 28000,
        sortOrder: 1,
        description: 'Espresso susu dengan gula aren.',
        imageBlobUrl: 'https://blob/old.webp',
        imageBlobPath: 'venues/venue_1/menu/menu_1.webp',
      }),
    })
  })

  it('preserves existing image metadata when unchanged payload omits image fields', async () => {
    const formData = new FormData()
    formData.set(
      'payload',
      JSON.stringify({
        name: 'Venue A',
        address: 'Jl. Venue',
        items: [
          {
            id: 'menu_1',
            name: 'Kopi Susu Gula Aren',
            price: 28000,
            sortOrder: 1,
            description: 'Espresso susu dengan gula aren.',
          },
        ],
      }),
    )

    const result = await saveVenueCatalog('venue_1', formData)

    expect(result.ok).toBe(true)
    expect(txVenueMenuItemUpdate).toHaveBeenCalledWith({
      where: { id: 'menu_1' },
      data: expect.objectContaining({
        imageBlobUrl: 'https://blob/old.webp',
        imageBlobPath: 'venues/venue_1/menu/menu_1.webp',
      }),
    })
  })

  it('still rejects name or price edits for frozen menu items', async () => {
    const formData = new FormData()
    formData.set(
      'payload',
      JSON.stringify({
        name: 'Venue A',
        address: 'Jl. Venue',
        items: [
          {
            id: 'menu_1',
            name: 'Kopi Susu Baru',
            price: 28000,
            sortOrder: 1,
            description: 'Metadata tetap boleh berbeda.',
            imageBlobUrl: 'https://blob/old.webp',
            imageBlobPath: 'venues/venue_1/menu/menu_1.webp',
          },
        ],
      }),
    )

    const result = await saveVenueCatalog('venue_1', formData)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.rootError).toContain('terkunci')
    }
    expect(txVenueMenuItemUpdate).not.toHaveBeenCalled()
  })
})
