import {
  EmailTemplateKey,
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
  RegistrationStatus,
  type Prisma,
} from '@prisma/client'

import type { EventRegistrantsTab } from '@/lib/admin/event-registrants-list-url'
import { registrationListWhere } from '@/lib/admin/event-registrants-list-url'

const TERMINAL: RegistrationStatus[] = [
  RegistrationStatus.rejected,
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
]

export type RegistrationEmailEligibilityInput = {
  status: RegistrationStatus
  contactEmail: string | null
  hasUnpaidUnderpayment: boolean
  rejectionReason?: string | null
  paymentIssueReason?: string | null
}

export function canSendRegistrationEmail(
  input: RegistrationEmailEligibilityInput,
  key: EmailTemplateKey,
): boolean {
  if (!input.contactEmail?.trim()) return false

  switch (key) {
    case EmailTemplateKey.invoice:
      return !input.hasUnpaidUnderpayment && !TERMINAL.includes(input.status)
    case EmailTemplateKey.invoice_underpayment:
      return input.hasUnpaidUnderpayment && !TERMINAL.includes(input.status)
    case EmailTemplateKey.registration_approved:
      return input.status === RegistrationStatus.approved
    case EmailTemplateKey.rejected:
      return input.status === RegistrationStatus.rejected && !!input.rejectionReason?.trim()
    case EmailTemplateKey.payment_issue:
      return input.status === RegistrationStatus.payment_issue && !!input.paymentIssueReason?.trim()
    case EmailTemplateKey.cancelled:
      return input.status === RegistrationStatus.cancelled
    case EmailTemplateKey.refunded:
      return input.status === RegistrationStatus.refunded
    case EmailTemplateKey.receipt:
      return !TERMINAL.includes(input.status)
    default:
      return false
  }
}

export function buildRegistrationInvoiceBlastWhere(
  eventId: string,
  opts: { respectListTab?: boolean; tab?: EventRegistrantsTab; q?: string },
): Prisma.RegistrationWhereInput {
  const base: Prisma.RegistrationWhereInput = {
    eventId,
    contactEmail: { not: null },
    status: { notIn: TERMINAL },
    adjustments: {
      none: {
        type: InvoiceAdjustmentType.underpayment,
        status: InvoiceAdjustmentStatus.unpaid,
      },
    },
  }

  if (!opts.respectListTab || !opts.tab) return base

  const listWhere = registrationListWhere(eventId, opts.tab, opts.q ?? '')
  return { AND: [base, listWhere] }
}
