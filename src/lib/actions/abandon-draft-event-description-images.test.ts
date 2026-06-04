import { describe, expect, it, vi, beforeEach } from 'vitest'

const { deleteAllBlobsWithPrefix } = vi.hoisted(() => ({
  deleteAllBlobsWithPrefix: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
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

vi.mock('@/lib/uploads/delete-blobs-by-prefix', () => ({
  deleteAllBlobsWithPrefix,
}))

import { prisma } from '@/lib/db/prisma'

import { abandonDraftEventDescriptionImages } from '@/lib/actions/abandon-draft-event-description-images'
import { signDescriptionAssetEventId } from '@/lib/public/description-asset-token'

const DRAFT_ID = '11111111-1111-4111-8111-111111111111'

describe('abandonDraftEventDescriptionImages', () => {
  beforeEach(() => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32))
    deleteAllBlobsWithPrefix.mockReset()
    vi.mocked(prisma.event.findUnique).mockReset()
  })

  it('tidak menghapus bila baris Event sudah ada', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: DRAFT_ID } as never)
    const token = signDescriptionAssetEventId(DRAFT_ID)
    const r = await abandonDraftEventDescriptionImages(DRAFT_ID, token)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.deleted).toBe(0)
    expect(deleteAllBlobsWithPrefix).not.toHaveBeenCalled()
  })

  it('menghapus prefix draf bila Event belum ada', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null)
    deleteAllBlobsWithPrefix.mockResolvedValue(2)
    const token = signDescriptionAssetEventId(DRAFT_ID)
    const r = await abandonDraftEventDescriptionImages(DRAFT_ID, token)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.deleted).toBe(2)
    expect(deleteAllBlobsWithPrefix).toHaveBeenCalledWith(`events/${DRAFT_ID}/description/`)
  })

  it('menolak token salah', async () => {
    const r = await abandonDraftEventDescriptionImages(DRAFT_ID, 'bad')
    expect(r.ok).toBe(false)
    expect(deleteAllBlobsWithPrefix).not.toHaveBeenCalled()
  })
})
