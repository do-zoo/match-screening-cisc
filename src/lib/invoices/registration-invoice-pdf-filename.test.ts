import { describe, expect, it } from 'vitest'
import { buildInvoicePdfFilename } from './registration-invoice-pdf-filename'

describe('buildInvoicePdfFilename', () => {
  it('builds registration filename', () => {
    expect(
      buildInvoicePdfFilename({
        kind: 'registration',
        eventSlug: 'nobar-final',
        registrationId: 'clxyz1234567890',
      }),
    ).toBe('tagihan-nobar-final-clxyz123.pdf')
  })

  it('builds adjustment filename', () => {
    expect(
      buildInvoicePdfFilename({
        kind: 'adjustment',
        eventSlug: 'nobar final',
        registrationId: 'reg1',
        adjustmentId: 'adjabcdefgh',
      }),
    ).toBe('penyesuaian-nobar-final-adjabcde.pdf')
  })
})
