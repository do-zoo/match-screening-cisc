import { RegistrationStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    registration: { findFirst: vi.fn() },
    invoiceAdjustment: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/public/load-club-branding', () => ({
  loadPublicClubBranding: vi.fn().mockResolvedValue({
    clubNameNav: 'CISC',
    contactEmail: 'info@cisc.test',
    websiteUrl: null,
    locationText: null,
    socialLinks: [],
  }),
  pickClubEmailContact: vi.fn(b => ({ contactEmail: b.contactEmail })),
}))

import { prisma } from '@/lib/db/prisma'
import { loadRegistrationInvoicePdfData } from './registration-invoice-pdf-data'

describe('loadRegistrationInvoicePdfData', () => {
  beforeEach(() => {
    vi.mocked(prisma.registration.findFirst).mockReset()
    vi.mocked(prisma.invoiceAdjustment.findFirst).mockReset()
  })

  it('returns error when registration missing', async () => {
    vi.mocked(prisma.registration.findFirst).mockResolvedValue(null)
    const res = await loadRegistrationInvoicePdfData({
      eventId: 'ev1',
      registrationId: 'reg1',
      kind: 'registration',
    })
    expect(res).toEqual({ ok: false, error: 'Pendaftaran tidak ditemukan.' })
  })

  it('returns vm for approved registration invoice', async () => {
    vi.mocked(prisma.registration.findFirst).mockResolvedValue({
      id: 'reg12345678',
      status: RegistrationStatus.approved,
      contactName: 'Budi',
      computedTotalAtSubmit: 500_000,
      ticketQty: 2,
      ticketCategory: { name: 'Reguler' },
      tickets: [
        {
          sortOrder: 1,
          ticketPriceApplied: 250_000,
          assignedHolder: { holderName: 'Budi' },
          mandatoryMenuItem: { name: 'Nasi' },
        },
      ],
      event: {
        title: 'Nobar',
        slug: 'nobar',
        kickOffAt: new Date('2026-06-10T10:00:00Z'),
        venue: { name: 'Studio' },
        bankAccount: { bankName: 'BCA', accountNumber: '123', accountName: 'CISC' },
      },
    } as never)

    const res = await loadRegistrationInvoicePdfData({
      eventId: 'ev1',
      registrationId: 'reg12345678',
      kind: 'registration',
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.paymentStatus).toBe('paid')
      expect(res.data.registrationTotalIdr).toBe(500_000)
      expect(res.data.bank).toBeNull()
    }
  })
})
