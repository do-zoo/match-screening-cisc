import { describe, expect, it } from 'vitest'

import { renderRegistrationInvoicePdf } from './render-registration-invoice-pdf'
import type { RegistrationInvoicePdfVm } from './registration-invoice-pdf-types'

const sampleVm: RegistrationInvoicePdfVm = {
  kind: 'registration',
  paymentStatus: 'awaiting_payment',
  issuedAt: new Date('2026-06-05T08:00:00Z'),
  clubNameNav: 'CISC',
  committeeContactEmail: 'info@cisc.test',
  registrationId: 'reg12345678',
  adjustmentId: null,
  contactName: 'Budi Santoso',
  eventTitle: 'Nobar Final',
  eventSlug: 'nobar-final',
  venueName: 'Studio CISC',
  kickOffAt: new Date('2026-06-10T10:00:00Z'),
  ticketCategoryName: 'Reguler',
  ticketQty: 2,
  registrationTotalIdr: 500_000,
  adjustmentAmountIdr: null,
  paidAt: null,
  lineItems: [
    { label: 'Tiket #1 · Budi Santoso', value: 'Rp 250.000', note: 'Menu: Nasi goreng' },
    { label: 'Tiket #2 · Budi Santoso', value: 'Rp 250.000', note: 'Menu: Nasi goreng' },
  ],
  bank: { bankName: 'BCA', accountNumber: '1234567890', accountName: 'CISC' },
}

describe('renderRegistrationInvoicePdf', () => {
  it('renders a non-empty PDF with expected filename', async () => {
    const result = await renderRegistrationInvoicePdf(sampleVm)

    expect(result.contentType).toBe('application/pdf')
    expect(result.filename).toBe('tagihan-nobar-final-reg12345.pdf')
    expect(result.buffer.byteLength).toBeGreaterThan(500)
  })
})
