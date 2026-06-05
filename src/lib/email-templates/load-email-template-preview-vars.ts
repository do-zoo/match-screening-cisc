import {
  EmailTemplateKey,
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
  RegistrationStatus,
} from '@prisma/client'

import { prisma } from '@/lib/db/prisma'
import {
  EMAIL_SHARED_TOKEN_META,
  sampleVarsFromCatalog,
  type EmailTemplateCatalogEntry,
} from '@/lib/email-templates/email-template-catalog'
import {
  buildTicketLineItems,
  sampleTransactionLineItemsJson,
  withTransactionLineItems,
  type RegistrationTicketForEmailLineItem,
} from '@/lib/email-templates/email-transaction-line-items'
import { buildRegistrationEmailUrlVars } from '@/lib/email-templates/registration-email-url-vars'
import { formatWaIdr } from '@/lib/wa-templates/format-wa-idr'

const previewTicketSelect = {
  orderBy: { sortOrder: 'asc' as const },
  select: {
    sortOrder: true,
    ticketPriceApplied: true,
    assignedHolder: { select: { holderName: true } },
    mandatoryMenuItem: { select: { name: true } },
  },
}

export type EmailTemplatePreviewDataSource = 'database' | 'sample'

function withRegistrationUrlVars(
  vars: Record<string, string>,
  eventSlug?: string | null,
  registrationId?: string,
): Record<string, string> {
  return {
    ...vars,
    ...buildRegistrationEmailUrlVars({
      origin: process.env.BETTER_AUTH_URL,
      eventSlug,
      registrationId,
    }),
  }
}

function formatEmailDateTime(d: Date): string {
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

async function varsFromLatestRegistrationInvoice(): Promise<Record<string, string> | null> {
  const reg = await prisma.registration.findFirst({
    where: { contactEmail: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      contactName: true,
      computedTotalAtSubmit: true,
      ticketQty: true,
      ticketCategory: { select: { name: true } },
      tickets: previewTicketSelect,
      event: {
        select: {
          title: true,
          slug: true,
          bankAccount: { select: { bankName: true, accountNumber: true, accountName: true } },
        },
      },
    },
  })
  if (!reg) return null

  const bank = reg.event.bankAccount
  const vars: Record<string, string> = {
    contact_name: reg.contactName,
    event_title: reg.event.title,
    total_amount_idr: formatWaIdr(reg.computedTotalAtSubmit),
    bank_name: bank.bankName,
    account_number: bank.accountNumber,
    account_name: bank.accountName,
    registration_id: reg.id,
    ticket_qty: String(reg.ticketQty),
    ticket_category_name: reg.ticketCategory.name,
  }
  return withTransactionLineItems(
    withRegistrationUrlVars(vars, reg.event.slug, reg.id),
    buildTicketLineItems(reg.tickets as RegistrationTicketForEmailLineItem[]),
  )
}

async function varsFromLatestUnderpaymentInvoice(): Promise<Record<string, string> | null> {
  const reg = await prisma.registration.findFirst({
    where: {
      contactEmail: { not: null },
      adjustments: {
        some: {
          type: InvoiceAdjustmentType.underpayment,
          status: InvoiceAdjustmentStatus.unpaid,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      contactName: true,
      computedTotalAtSubmit: true,
      ticketQty: true,
      ticketCategory: { select: { name: true } },
      tickets: previewTicketSelect,
      event: {
        select: {
          title: true,
          slug: true,
          bankAccount: { select: { bankName: true, accountNumber: true, accountName: true } },
        },
      },
      adjustments: {
        where: {
          type: InvoiceAdjustmentType.underpayment,
          status: InvoiceAdjustmentStatus.unpaid,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { amount: true },
      },
    },
  })
  const adj = reg?.adjustments[0]
  if (!reg || !adj) return null

  const bank = reg.event.bankAccount
  const registrationTotal = reg.computedTotalAtSubmit
  const shortfall = adj.amount
  const vars: Record<string, string> = {
    contact_name: reg.contactName,
    event_title: reg.event.title,
    registration_total_idr: formatWaIdr(registrationTotal),
    adjustment_amount_idr: formatWaIdr(shortfall),
    bank_name: bank.bankName,
    account_number: bank.accountNumber,
    account_name: bank.accountName,
    registration_id: reg.id,
    ticket_qty: String(reg.ticketQty),
    ticket_category_name: reg.ticketCategory.name,
  }
  if (shortfall < registrationTotal) {
    vars.amount_paid_idr = formatWaIdr(registrationTotal - shortfall)
  }
  return withTransactionLineItems(
    withRegistrationUrlVars(vars, reg.event.slug, reg.id),
    buildTicketLineItems(reg.tickets as RegistrationTicketForEmailLineItem[]),
  )
}

async function varsFromLatestApprovedRegistration(): Promise<Record<string, string> | null> {
  const reg = await prisma.registration.findFirst({
    where: {
      status: RegistrationStatus.approved,
      contactEmail: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      contactName: true,
      computedTotalAtSubmit: true,
      ticketQty: true,
      ticketCategory: { select: { name: true } },
      tickets: previewTicketSelect,
      event: {
        select: {
          title: true,
          slug: true,
          kickOffAt: true,
          venue: { select: { name: true, address: true, mapUrl: true } },
        },
      },
    },
  })
  if (!reg) return null

  const vars: Record<string, string> = {
    contact_name: reg.contactName,
    event_title: reg.event.title,
    registration_id: reg.id,
    computed_total_idr: formatWaIdr(reg.computedTotalAtSubmit),
    ticket_qty: String(reg.ticketQty),
    ticket_category_name: reg.ticketCategory.name,
    venue: reg.event.venue.name,
    venue_address: reg.event.venue.address,
    start_at_formatted: formatEmailDateTime(reg.event.kickOffAt),
  }
  if (reg.event.venue.mapUrl?.trim()) {
    vars.venue_map_url = reg.event.venue.mapUrl.trim()
  }
  return withTransactionLineItems(
    withRegistrationUrlVars(vars, reg.event.slug, reg.id),
    buildTicketLineItems(reg.tickets as RegistrationTicketForEmailLineItem[]),
  )
}

function varsForMagicLinkPreview(entry: EmailTemplateCatalogEntry): Record<string, string> {
  const base = sampleVarsFromCatalog(entry)
  const origin = process.env.BETTER_AUTH_URL?.replace(/\/$/, '')
  if (origin) {
    base.magic_link_url = `${origin}/admin/sign-in`
  }
  return base
}

async function varsFromLatestRegistrationByStatus(
  status: RegistrationStatus,
): Promise<Record<string, string> | null> {
  const reg = await prisma.registration.findFirst({
    where: { status, contactEmail: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      contactName: true,
      computedTotalAtSubmit: true,
      ticketQty: true,
      ticketCategory: { select: { name: true } },
      tickets: previewTicketSelect,
      event: { select: { title: true, slug: true } },
      rejectionReason: true,
      paymentIssueReason: true,
    },
  })
  if (!reg) return null

  const vars: Record<string, string> = {
    contact_name: reg.contactName,
    event_title: reg.event.title,
    registration_id: reg.id,
    computed_total_idr: formatWaIdr(reg.computedTotalAtSubmit),
    ticket_qty: String(reg.ticketQty),
    ticket_category_name: reg.ticketCategory.name,
  }
  if (status === RegistrationStatus.rejected && reg.rejectionReason) {
    vars.reason = reg.rejectionReason
  } else if (status === RegistrationStatus.payment_issue && reg.paymentIssueReason) {
    vars.reason = reg.paymentIssueReason
  } else {
    vars.reason = 'Contoh alasan untuk pratinjau template.'
  }
  return withTransactionLineItems(
    withRegistrationUrlVars(vars, reg.event.slug, reg.id),
    buildTicketLineItems(reg.tickets as RegistrationTicketForEmailLineItem[]),
  )
}

async function loadDbVarsForKey(key: EmailTemplateKey): Promise<Record<string, string> | null> {
  switch (key) {
    case EmailTemplateKey.invoice:
      return varsFromLatestRegistrationInvoice()
    case EmailTemplateKey.invoice_underpayment:
      return varsFromLatestUnderpaymentInvoice()
    case EmailTemplateKey.registration_approved:
    case EmailTemplateKey.receipt:
      return varsFromLatestApprovedRegistration()
    case EmailTemplateKey.rejected:
      return varsFromLatestRegistrationByStatus(RegistrationStatus.rejected)
    case EmailTemplateKey.payment_issue:
      return varsFromLatestRegistrationByStatus(RegistrationStatus.payment_issue)
    case EmailTemplateKey.cancelled:
      return varsFromLatestRegistrationByStatus(RegistrationStatus.cancelled)
    case EmailTemplateKey.refunded:
      return varsFromLatestRegistrationByStatus(RegistrationStatus.refunded)
    default:
      return null
  }
}

/** Variabel pratinjau editor: data registrasi/acara terbaru dari DB, atau sampel katalog bila kosong. */
export async function loadEmailTemplatePreviewVars(
  key: EmailTemplateKey,
  entry: EmailTemplateCatalogEntry,
): Promise<{ vars: Record<string, string>; dataSource: EmailTemplatePreviewDataSource }> {
  if (key === EmailTemplateKey.magic_link) {
    return { vars: varsForMagicLinkPreview(entry), dataSource: 'sample' }
  }

  if (key === EmailTemplateKey.admin_invite) {
    const sample = sampleVarsFromCatalog(entry)
    const origin = process.env.BETTER_AUTH_URL?.replace(/\/$/, '')
    if (origin) sample.invite_url = `${origin}/admin/invite/contoh-token`
    return { vars: sample, dataSource: 'sample' }
  }

  if (key === EmailTemplateKey.otp) {
    return { vars: sampleVarsFromCatalog(entry), dataSource: 'sample' }
  }

  const fromDb = await loadDbVarsForKey(key)
  if (fromDb) {
    return { vars: fromDb, dataSource: 'database' }
  }

  const sample = sampleVarsFromCatalog(entry)
  const withLineItems = new Set<EmailTemplateKey>([
    EmailTemplateKey.invoice,
    EmailTemplateKey.invoice_underpayment,
    EmailTemplateKey.registration_approved,
    EmailTemplateKey.receipt,
    EmailTemplateKey.rejected,
    EmailTemplateKey.payment_issue,
    EmailTemplateKey.cancelled,
    EmailTemplateKey.refunded,
  ])
  if (withLineItems.has(key)) {
    sample.transaction_line_items_json = sampleTransactionLineItemsJson()
    if (key === EmailTemplateKey.invoice_underpayment) {
      sample.registration_total_idr = EMAIL_SHARED_TOKEN_META.computed_total_idr.sampleValue
      sample.amount_paid_idr = 'Rp700.000'
    }
  }
  return { vars: sample, dataSource: 'sample' }
}
