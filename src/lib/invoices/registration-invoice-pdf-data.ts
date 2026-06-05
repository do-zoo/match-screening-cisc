import { InvoiceAdjustmentStatus, RegistrationStatus } from '@prisma/client'

import { prisma } from '@/lib/db/prisma'
import { buildTicketLineItems } from '@/lib/email-templates/email-transaction-line-items'
import { loadPublicClubBranding, pickClubEmailContact } from '@/lib/public/load-club-branding'
import { canDownloadRegistrationInvoicePdf } from './registration-invoice-pdf-eligibility'
import type { InvoicePdfKind, RegistrationInvoicePdfVm } from './registration-invoice-pdf-types'

export type LoadRegistrationInvoicePdfResult =
  | { ok: true; data: RegistrationInvoicePdfVm }
  | { ok: false; error: string }

const registrationSelect = {
  id: true,
  status: true,
  contactName: true,
  computedTotalAtSubmit: true,
  ticketQty: true,
  ticketCategory: { select: { name: true } },
  tickets: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      sortOrder: true,
      ticketPriceApplied: true,
      assignedHolder: { select: { holderName: true } },
      mandatoryMenuItem: { select: { name: true } },
    },
  },
  event: {
    select: {
      title: true,
      slug: true,
      kickOffAt: true,
      venue: { select: { name: true } },
      bankAccount: { select: { bankName: true, accountNumber: true, accountName: true } },
    },
  },
} as const

export async function loadRegistrationInvoicePdfData(input: {
  eventId: string
  registrationId: string
  kind: InvoicePdfKind
  adjustmentId?: string
}): Promise<LoadRegistrationInvoicePdfResult> {
  const registration = await prisma.registration.findFirst({
    where: { id: input.registrationId, eventId: input.eventId },
    select: registrationSelect,
  })

  if (!registration) return { ok: false, error: 'Pendaftaran tidak ditemukan.' }

  if (
    !canDownloadRegistrationInvoicePdf({
      kind: input.kind,
      registrationStatus: registration.status,
    })
  ) {
    return { ok: false, error: 'Tagihan tidak tersedia untuk status ini.' }
  }

  const branding = await loadPublicClubBranding()
  const committeeEmail = pickClubEmailContact(branding).contactEmail
  const lineItems = buildTicketLineItems(registration.tickets)
  const bank = registration.event.bankAccount

  if (input.kind === 'registration') {
    const isPaid = registration.status === RegistrationStatus.approved
    const vm: RegistrationInvoicePdfVm = {
      kind: 'registration',
      paymentStatus: isPaid ? 'paid' : 'awaiting_payment',
      issuedAt: new Date(),
      clubNameNav: branding.clubNameNav,
      committeeContactEmail: committeeEmail,
      registrationId: registration.id,
      adjustmentId: null,
      contactName: registration.contactName,
      eventTitle: registration.event.title,
      eventSlug: registration.event.slug,
      venueName: registration.event.venue.name,
      kickOffAt: registration.event.kickOffAt,
      ticketCategoryName: registration.ticketCategory.name,
      ticketQty: registration.ticketQty,
      registrationTotalIdr: registration.computedTotalAtSubmit,
      adjustmentAmountIdr: null,
      paidAt: null,
      lineItems,
      bank: isPaid || !bank ? null : bank,
    }
    return { ok: true, data: vm }
  }

  if (!input.adjustmentId?.trim()) {
    return { ok: false, error: 'ID penyesuaian wajib untuk tagihan penyesuaian.' }
  }

  const adjustment = await prisma.invoiceAdjustment.findFirst({
    where: {
      id: input.adjustmentId,
      registrationId: registration.id,
    },
    select: { id: true, amount: true, status: true, paidAt: true },
  })

  if (!adjustment) return { ok: false, error: 'Penyesuaian tidak ditemukan.' }

  const isPaid = adjustment.status === InvoiceAdjustmentStatus.paid
  const vm: RegistrationInvoicePdfVm = {
    kind: 'adjustment',
    paymentStatus: isPaid ? 'paid' : 'unpaid_adjustment',
    issuedAt: new Date(),
    clubNameNav: branding.clubNameNav,
    committeeContactEmail: committeeEmail,
    registrationId: registration.id,
    adjustmentId: adjustment.id,
    contactName: registration.contactName,
    eventTitle: registration.event.title,
    eventSlug: registration.event.slug,
    venueName: registration.event.venue.name,
    kickOffAt: registration.event.kickOffAt,
    ticketCategoryName: registration.ticketCategory.name,
    ticketQty: registration.ticketQty,
    registrationTotalIdr: registration.computedTotalAtSubmit,
    adjustmentAmountIdr: adjustment.amount,
    paidAt: adjustment.paidAt,
    lineItems,
    bank: isPaid || !bank ? null : bank,
  }
  return { ok: true, data: vm }
}
