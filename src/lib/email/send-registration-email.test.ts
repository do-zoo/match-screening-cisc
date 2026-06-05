import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailTemplateKey, RegistrationStatus } from '@prisma/client'

const mockSendTransactional = vi.fn()
const mockTryBuild = vi.fn()
const mockFindFirst = vi.fn()
const mockCreateLog = vi.fn()
const mockPrefsFind = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    registration: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    emailDeliveryLog: {
      create: (...args: unknown[]) => mockCreateLog(...args),
    },
    clubNotificationPreferences: {
      findUnique: (...args: unknown[]) => mockPrefsFind(...args),
    },
  },
}))

vi.mock('@/lib/auth/send-transactional-email', () => ({
  sendTransactionalEmail: (...args: unknown[]) => mockSendTransactional(...args),
}))

vi.mock('@/lib/invoices/try-build-invoice-email-attachment', () => ({
  tryBuildInvoiceEmailAttachment: (...args: unknown[]) => mockTryBuild(...args),
}))

vi.mock('@/lib/email-templates/load-club-email-templates', () => ({
  loadClubEmailTemplates: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/email-templates/render-invoice-email', () => ({
  renderRegistrationInvoiceEmail: vi.fn().mockResolvedValue({
    subject: 'Tagihan pendaftaran',
    text: 'Silakan transfer',
    html: '<p>Silakan transfer</p>',
  }),
  renderInvoiceUnderpaymentEmail: vi.fn(),
}))

function baseRegistration() {
  return {
    id: 'reg-1',
    status: RegistrationStatus.pending_review,
    contactName: 'Budi',
    contactEmail: 'budi@example.com',
    computedTotalAtSubmit: 500_000,
    ticketQty: 1,
    rejectionReason: null,
    paymentIssueReason: null,
    ticketCategory: { name: 'Reguler' },
    tickets: [
      {
        sortOrder: 1,
        ticketPriceApplied: 500_000,
        assignedHolder: { holderName: 'Budi' },
        mandatoryMenuItem: { name: 'Nasi' },
      },
    ],
    adjustments: [] as Array<{ id: string; amount: number }>,
    event: {
      title: 'Acara Test',
      slug: 'acara-test',
      kickOffAt: new Date('2026-06-10T10:00:00Z'),
      venue: { name: 'Venue', address: 'Jl. Test', mapUrl: null },
      bankAccount: {
        bankName: 'BCA',
        accountNumber: '123',
        accountName: 'CISC',
      },
    },
  }
}

describe('sendRegistrationEmailByKey invoice attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('AUTH_TRANSACTIONAL_FROM', 'App <noreply@app.com>')
    mockFindFirst.mockResolvedValue(baseRegistration())
    mockCreateLog.mockResolvedValue({ id: 'log-1' })
    mockSendTransactional.mockResolvedValue(undefined)
    mockTryBuild.mockResolvedValue({
      filename: 'tagihan-acara-test-reg-1.pdf',
      content: Buffer.from('%PDF-1.4 fake'),
    })
  })

  it('passes attachments when emailAttachInvoicePdf is on and template is invoice', async () => {
    mockPrefsFind.mockResolvedValue({
      outboundMode: 'live',
      emailAttachInvoicePdf: true,
    })

    const { sendRegistrationEmailByKey } = await import('@/lib/email/send-registration-email')

    const result = await sendRegistrationEmailByKey({
      registrationId: 'reg-1',
      eventId: 'event-1',
      templateKey: EmailTemplateKey.invoice,
      actorAuthUserId: 'user-1',
      actorProfileId: 'profile-1',
    })

    expect(result).toEqual({ ok: true })
    expect(mockTryBuild).toHaveBeenCalledWith({
      eventId: 'event-1',
      registrationId: 'reg-1',
      templateKey: EmailTemplateKey.invoice,
      unpaidAdjustmentId: null,
    })
    expect(mockSendTransactional).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'budi@example.com',
        attachments: [
          expect.objectContaining({ filename: 'tagihan-acara-test-reg-1.pdf' }),
        ],
      }),
    )
  })

  it('does not pass attachments when emailAttachInvoicePdf is off', async () => {
    mockPrefsFind.mockResolvedValue({
      outboundMode: 'live',
      emailAttachInvoicePdf: false,
    })

    const { sendRegistrationEmailByKey } = await import('@/lib/email/send-registration-email')

    const result = await sendRegistrationEmailByKey({
      registrationId: 'reg-1',
      eventId: 'event-1',
      templateKey: EmailTemplateKey.invoice,
      actorAuthUserId: 'user-1',
      actorProfileId: 'profile-1',
    })

    expect(result).toEqual({ ok: true })
    expect(mockTryBuild).not.toHaveBeenCalled()
    expect(mockSendTransactional).toHaveBeenCalledWith(
      expect.not.objectContaining({ attachments: expect.anything() }),
    )
  })
})
