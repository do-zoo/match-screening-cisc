import { RegistrationStatus } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { canDownloadRegistrationInvoicePdf } from './registration-invoice-pdf-eligibility'

describe('canDownloadRegistrationInvoicePdf', () => {
  it('allows registration invoice for non-terminal statuses', () => {
    for (const status of [
      RegistrationStatus.submitted,
      RegistrationStatus.pending_review,
      RegistrationStatus.payment_issue,
      RegistrationStatus.approved,
    ]) {
      expect(canDownloadRegistrationInvoicePdf({ kind: 'registration', registrationStatus: status })).toBe(true)
    }
  })

  it('blocks registration invoice for terminal statuses', () => {
    for (const status of [
      RegistrationStatus.rejected,
      RegistrationStatus.cancelled,
      RegistrationStatus.refunded,
    ]) {
      expect(canDownloadRegistrationInvoicePdf({ kind: 'registration', registrationStatus: status })).toBe(false)
    }
  })

  it('always allows adjustment when row exists', () => {
    expect(
      canDownloadRegistrationInvoicePdf({
        kind: 'adjustment',
        registrationStatus: RegistrationStatus.cancelled,
      }),
    ).toBe(true)
  })
})
