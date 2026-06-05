import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegistrationStatus } from '@prisma/client'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    registration: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    clubNotificationPreferences: {
      findUnique: vi.fn().mockResolvedValue({
        emailAutoOnApprove: false,
        emailAutoOnReject: false,
        emailAutoOnPaymentIssue: false,
        emailAutoOnReceipt: false,
        emailAutoOnCancel: false,
        emailAutoOnRefund: false,
      }),
    },
  },
}))

vi.mock('@/lib/auth/session', () => ({
  requireAdminSession: vi.fn(),
}))

vi.mock('@/lib/auth/admin-context', () => ({
  getAdminContext: vi.fn(),
}))

vi.mock('@/lib/permissions/guards', () => ({
  canVerifyEvent: vi.fn(() => true),
}))

vi.mock('@/lib/email/send-registration-approved-email', () => ({
  sendRegistrationApprovedEmailForRegistration: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/lib/email/send-registration-email', () => ({
  maybeAutoSendRegistrationEmail: vi.fn().mockResolvedValue({ sent: false }),
}))

import { prisma } from '@/lib/db/prisma'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { approveRegistration } from '@/lib/actions/verify-registration'

const mockFindUnique = vi.mocked(prisma.registration.findUnique)
const mockUpdate = vi.mocked(prisma.registration.update)

describe('approveRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdminSession).mockResolvedValue({ user: { id: 'user-1' } } as never)
    vi.mocked(getAdminContext).mockResolvedValue({ role: 'Admin', profileId: 'profile-1' } as never)
    mockUpdate.mockResolvedValue({ id: 'reg-1' } as never)
  })

  it('mengizinkan ubah keputusan dari status approved', async () => {
    mockFindUnique.mockResolvedValue({
      status: RegistrationStatus.approved,
      eventId: 'event-1',
    } as never)

    const result = await approveRegistration('event-1', 'reg-1')

    expect(result.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'reg-1', eventId: 'event-1' },
        data: expect.objectContaining({ status: RegistrationStatus.approved }),
      }),
    )
  })
})
