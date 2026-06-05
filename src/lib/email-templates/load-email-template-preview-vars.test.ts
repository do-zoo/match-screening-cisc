import { EmailTemplateKey, RegistrationStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { loadEmailTemplatePreviewVars } from '@/lib/email-templates/load-email-template-preview-vars'
import { formatWaIdr } from '@/lib/wa-templates/format-wa-idr'

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    registration: { findFirst: findFirstMock },
  },
}))

describe('loadEmailTemplatePreviewVars', () => {
  beforeEach(() => {
    findFirstMock.mockReset()
  })

  it('uses database registration for registration_approved preview', async () => {
    const kickOff = new Date('2026-07-01T07:00:00.000Z')
    findFirstMock.mockResolvedValue({
      id: 'reg_real_1',
      contactName: 'Ani Wijaya',
      computedTotalAtSubmit: 900_000,
      ticketQty: 2,
      ticketCategory: { name: 'Reguler' },
      tickets: [
        {
          sortOrder: 1,
          ticketPriceApplied: 450_000,
          assignedHolder: { holderName: 'Ani Wijaya' },
          mandatoryMenuItem: { name: 'Snack' },
        },
        {
          sortOrder: 2,
          ticketPriceApplied: 450_000,
          assignedHolder: { holderName: 'Budi Santoso' },
          mandatoryMenuItem: null,
        },
      ],
      event: {
        title: 'Turnamen Internal',
        kickOffAt: kickOff,
        openGateAt: null,
        venue: {
          name: 'Lapangan A',
          address: 'Kompleks Olahraga, Tangerang Selatan',
          mapUrl: 'https://maps.google.com/?q=lapangan-a',
        },
      },
    })

    const entry = getEmailTemplateEntry(EmailTemplateKey.registration_approved)
    const { vars, dataSource } = await loadEmailTemplatePreviewVars(
      EmailTemplateKey.registration_approved,
      entry,
    )

    expect(dataSource).toBe('database')
    expect(vars.registration_id).toBe('reg_real_1')
    expect(vars.contact_name).toBe('Ani Wijaya')
    expect(vars.computed_total_idr).toBe(formatWaIdr(900_000))
    expect(vars.venue_address).toBe('Kompleks Olahraga, Tangerang Selatan')
    expect(vars.venue_map_url).toBe('https://maps.google.com/?q=lapangan-a')
    expect(vars.transaction_line_items_json).toBeTruthy()
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: RegistrationStatus.approved }),
      }),
    )
  })

  it('falls back to catalog sample when no registration in database', async () => {
    findFirstMock.mockResolvedValue(null)

    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice)
    const { vars, dataSource } = await loadEmailTemplatePreviewVars(EmailTemplateKey.invoice, entry)

    expect(dataSource).toBe('sample')
    expect(vars.contact_name).toBe(entry.tokenMeta.contact_name.sampleValue)
  })
})
