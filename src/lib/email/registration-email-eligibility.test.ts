import { EmailTemplateKey, RegistrationStatus } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { canSendRegistrationEmail } from '@/lib/email/registration-email-eligibility'

describe('canSendRegistrationEmail', () => {
  const base = {
    contactEmail: 'a@b.com',
    hasUnpaidUnderpayment: false,
  }

  it('invoice blocked when unpaid underpayment exists', () => {
    expect(
      canSendRegistrationEmail(
        { ...base, status: RegistrationStatus.pending_review, hasUnpaidUnderpayment: true },
        EmailTemplateKey.invoice,
      ),
    ).toBe(false)
  })

  it('invoice_underpayment requires unpaid adjustment', () => {
    expect(
      canSendRegistrationEmail(
        { ...base, status: RegistrationStatus.pending_review, hasUnpaidUnderpayment: true },
        EmailTemplateKey.invoice_underpayment,
      ),
    ).toBe(true)
  })

  it('registration_approved requires approved status', () => {
    expect(
      canSendRegistrationEmail(
        { ...base, status: RegistrationStatus.pending_review },
        EmailTemplateKey.registration_approved,
      ),
    ).toBe(false)
    expect(
      canSendRegistrationEmail(
        { ...base, status: RegistrationStatus.approved },
        EmailTemplateKey.registration_approved,
      ),
    ).toBe(true)
  })

  it('rejected requires reason', () => {
    expect(
      canSendRegistrationEmail(
        { ...base, status: RegistrationStatus.rejected, rejectionReason: '  ' },
        EmailTemplateKey.rejected,
      ),
    ).toBe(false)
    expect(
      canSendRegistrationEmail(
        { ...base, status: RegistrationStatus.rejected, rejectionReason: 'Bukti tidak jelas' },
        EmailTemplateKey.rejected,
      ),
    ).toBe(true)
  })
})
