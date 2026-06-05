import {
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
  RegistrationStatus,
  type Prisma,
} from '@prisma/client'

import { registrationListWhere, type EventRegistrantsTab } from '@/lib/admin/event-registrants-list-url'

const EXCLUDED_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.rejected,
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
]

export type InvoiceBlastCandidate = {
  registrationId: string
  contactEmail: string
  contactName: string
  adjustmentAmountIdr: number
  eventTitle: string
  bankName: string
  accountNumber: string
  accountName: string
}

export function buildInvoiceBlastRegistrationWhere(
  eventId: string,
  opts: { respectListTab?: boolean; tab?: EventRegistrantsTab; q?: string },
): Prisma.RegistrationWhereInput {
  const base: Prisma.RegistrationWhereInput = {
    eventId,
    contactEmail: { not: null },
    status: { notIn: EXCLUDED_STATUSES },
    adjustments: {
      some: {
        type: InvoiceAdjustmentType.underpayment,
        status: InvoiceAdjustmentStatus.unpaid,
      },
    },
  }

  if (!opts.respectListTab || !opts.tab) return base

  const listWhere = registrationListWhere(eventId, opts.tab, opts.q ?? '')
  return { AND: [base, listWhere] }
}

export type InvoiceBlastPreview = {
  eligible: number
  skippedNoEmail: number
  skippedNoAdjustment: number
  skippedStatus: number
}
