export type InvoicePdfKind = 'registration' | 'adjustment'

export type InvoicePdfPaymentStatus = 'awaiting_payment' | 'unpaid_adjustment' | 'paid'

export type RegistrationInvoicePdfVm = {
  kind: InvoicePdfKind
  paymentStatus: InvoicePdfPaymentStatus
  issuedAt: Date
  clubNameNav: string
  committeeContactEmail: string | null
  registrationId: string
  adjustmentId: string | null
  contactName: string
  eventTitle: string
  eventSlug: string
  venueName: string
  kickOffAt: Date
  ticketCategoryName: string
  ticketQty: number
  registrationTotalIdr: number
  adjustmentAmountIdr: number | null
  paidAt: Date | null
  lineItems: Array<{ label: string; value: string; note?: string }>
  bank: { bankName: string; accountNumber: string; accountName: string } | null
}
