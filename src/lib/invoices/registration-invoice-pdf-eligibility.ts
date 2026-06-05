import { RegistrationStatus } from '@prisma/client'
import type { InvoicePdfKind } from './registration-invoice-pdf-types'

const TERMINAL: RegistrationStatus[] = [
  RegistrationStatus.rejected,
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
]

export function canDownloadRegistrationInvoicePdf(input: {
  kind: InvoicePdfKind
  registrationStatus: RegistrationStatus
}): boolean {
  if (input.kind === 'adjustment') return true
  return !TERMINAL.includes(input.registrationStatus)
}
