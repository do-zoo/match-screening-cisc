import type { InvoicePdfKind } from './registration-invoice-pdf-types'

function slugSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'acara'
}

export function buildInvoicePdfFilename(input: {
  kind: InvoicePdfKind
  eventSlug: string
  registrationId: string
  adjustmentId?: string | null
}): string {
  const slug = slugSafe(input.eventSlug)
  if (input.kind === 'adjustment' && input.adjustmentId) {
    return `penyesuaian-${slug}-${input.adjustmentId.slice(0, 8)}.pdf`
  }
  return `tagihan-${slug}-${input.registrationId.slice(0, 8)}.pdf`
}
