import { describe, expect, it } from 'vitest'

import { buildRegistrationInvoicePdfUrl } from './build-registration-invoice-pdf-url'

describe('buildRegistrationInvoicePdfUrl', () => {
  it('builds registration preview URL with inline disposition default', () => {
    const url = buildRegistrationInvoicePdfUrl({
      eventId: 'evt-1',
      registrationId: 'reg-1',
      kind: 'registration',
    })
    expect(url).toBe(
      '/api/admin/events/evt-1/registrants/reg-1/invoice-pdf?kind=registration&disposition=inline',
    )
  })

  it('builds registration download URL with attachment disposition', () => {
    const url = buildRegistrationInvoicePdfUrl({
      eventId: 'evt-1',
      registrationId: 'reg-1',
      kind: 'registration',
      disposition: 'attachment',
    })
    expect(url).toBe(
      '/api/admin/events/evt-1/registrants/reg-1/invoice-pdf?kind=registration&disposition=attachment',
    )
  })

  it('builds adjustment URL with adjustmentId query param', () => {
    const url = buildRegistrationInvoicePdfUrl({
      eventId: 'evt-2',
      registrationId: 'reg-2',
      kind: 'adjustment',
      adjustmentId: 'adj-99',
      disposition: 'inline',
    })
    expect(url).toBe(
      '/api/admin/events/evt-2/registrants/reg-2/invoice-pdf?kind=adjustment&disposition=inline&adjustmentId=adj-99',
    )
  })
})
