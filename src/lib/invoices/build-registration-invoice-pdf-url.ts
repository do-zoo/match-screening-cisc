import type { InvoicePdfKind } from './registration-invoice-pdf-types'

export function buildRegistrationInvoicePdfUrl(input: {
  eventId: string
  registrationId: string
  kind: InvoicePdfKind
  adjustmentId?: string
  disposition?: 'inline' | 'attachment'
}): string {
  const params = new URLSearchParams({
    kind: input.kind,
    disposition: input.disposition ?? 'inline',
  })
  if (input.adjustmentId) params.set('adjustmentId', input.adjustmentId)
  return `/api/admin/events/${input.eventId}/registrants/${input.registrationId}/invoice-pdf?${params.toString()}`
}
