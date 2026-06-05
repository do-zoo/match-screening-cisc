import { EmailTemplateKey } from '@prisma/client'

import { CLUB_EMAIL_DEFAULT_BODIES } from '@/lib/email-templates/default-bodies'
import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { parseStoredEmailBody } from '@/lib/email-templates/parse-stored-email-body'
import { renderEmailFromBlocks } from '@/lib/email-templates/render-email-from-blocks'
import type { EmailTransactionLineItem } from '@/lib/email-templates/email-transaction-line-items'
import { withTransactionLineItems } from '@/lib/email-templates/email-transaction-line-items'
import { loadPublicClubBranding, pickClubEmailContact } from '@/lib/public/load-club-branding'
import { buildRegistrationEmailUrlVars } from '@/lib/email-templates/registration-email-url-vars'
import { formatWaIdr } from '@/lib/wa-templates/format-wa-idr'

export type InvoiceEmailCtx = {
  contactName: string
  eventTitle: string
  eventSlug?: string
  adjustmentAmountIdr: number
  registrationTotalIdr: number
  /** Diisi bila kekurangan < total pendaftaran — membantu peserta memahami sisa tagihan. */
  amountPaidIdr?: number
  bankName: string
  accountNumber: string
  accountName: string
  registrationId?: string
  ticketCategoryName?: string
  ticketQty?: number
  ticketLineItems?: EmailTransactionLineItem[]
}

export type RegistrationInvoiceEmailCtx = {
  contactName: string
  eventTitle: string
  eventSlug?: string
  totalAmountIdr: number
  bankName: string
  accountNumber: string
  accountName: string
  registrationId?: string
  ticketCategoryName?: string
  ticketQty?: number
  ticketLineItems?: EmailTransactionLineItem[]
}

function varsFromUnderpaymentCtx(ctx: InvoiceEmailCtx): Record<string, string> {
  const vars: Record<string, string> = {
    contact_name: ctx.contactName,
    event_title: ctx.eventTitle,
    registration_total_idr: formatWaIdr(ctx.registrationTotalIdr),
    adjustment_amount_idr: formatWaIdr(ctx.adjustmentAmountIdr),
    bank_name: ctx.bankName,
    account_number: ctx.accountNumber,
    account_name: ctx.accountName,
  }
  if (ctx.registrationId) vars.registration_id = ctx.registrationId
  if (ctx.ticketCategoryName?.trim()) vars.ticket_category_name = ctx.ticketCategoryName.trim()
  if (ctx.ticketQty != null) vars.ticket_qty = String(ctx.ticketQty)
  if (ctx.amountPaidIdr != null && ctx.amountPaidIdr > 0) {
    vars.amount_paid_idr = formatWaIdr(ctx.amountPaidIdr)
  }
  return withTransactionLineItems(
    {
      ...vars,
      ...buildRegistrationEmailUrlVars({
        origin: process.env.BETTER_AUTH_URL,
        eventSlug: ctx.eventSlug,
        registrationId: ctx.registrationId,
      }),
    },
    ctx.ticketLineItems ?? [],
  )
}

function varsFromRegistrationCtx(ctx: RegistrationInvoiceEmailCtx): Record<string, string> {
  const vars: Record<string, string> = {
    contact_name: ctx.contactName,
    event_title: ctx.eventTitle,
    total_amount_idr: formatWaIdr(ctx.totalAmountIdr),
    bank_name: ctx.bankName,
    account_number: ctx.accountNumber,
    account_name: ctx.accountName,
  }
  if (ctx.registrationId) vars.registration_id = ctx.registrationId
  if (ctx.ticketCategoryName?.trim()) vars.ticket_category_name = ctx.ticketCategoryName.trim()
  if (ctx.ticketQty != null) vars.ticket_qty = String(ctx.ticketQty)
  return withTransactionLineItems(
    {
      ...vars,
      ...buildRegistrationEmailUrlVars({
        origin: process.env.BETTER_AUTH_URL,
        eventSlug: ctx.eventSlug,
        registrationId: ctx.registrationId,
      }),
    },
    ctx.ticketLineItems ?? [],
  )
}

async function renderInvoiceTemplateEmail(
  key: typeof EmailTemplateKey.invoice | typeof EmailTemplateKey.invoice_underpayment,
  fromDb: { subject: string; body: string } | { subject: string; blocks: EmailBlock[] } | null,
  vars: Record<string, string>,
): Promise<{ subject: string; text: string; html: string }> {
  const entry = getEmailTemplateEntry(key)
  const defaults = CLUB_EMAIL_DEFAULT_BODIES[key]

  const subject = fromDb?.subject ?? defaults.subject
  const blocks =
    fromDb && 'blocks' in fromDb
      ? fromDb.blocks
      : fromDb
        ? parseStoredEmailBody(key, fromDb.body)
        : entry.defaultBlocks

  const branding = await loadPublicClubBranding()
  const renderOpts = {
    key,
    subject,
    blocks,
    vars: { ...vars, club_name_nav: branding.clubNameNav },
    clubNameNav: branding.clubNameNav,
    logoBlobUrl: branding.logoBlobUrl,
    contact: pickClubEmailContact(branding),
  }

  try {
    return await renderEmailFromBlocks(renderOpts)
  } catch {
    return await renderEmailFromBlocks({
      ...renderOpts,
      subject: defaults.subject,
      blocks: entry.defaultBlocks,
    })
  }
}

export async function renderInvoiceUnderpaymentEmail(
  fromDb: { subject: string; body: string } | { subject: string; blocks: EmailBlock[] } | null,
  ctx: InvoiceEmailCtx,
): Promise<{ subject: string; text: string; html: string }> {
  return renderInvoiceTemplateEmail(
    EmailTemplateKey.invoice_underpayment,
    fromDb,
    varsFromUnderpaymentCtx(ctx),
  )
}

export async function renderRegistrationInvoiceEmail(
  fromDb: { subject: string; body: string } | { subject: string; blocks: EmailBlock[] } | null,
  ctx: RegistrationInvoiceEmailCtx,
): Promise<{ subject: string; text: string; html: string }> {
  return renderInvoiceTemplateEmail(EmailTemplateKey.invoice, fromDb, varsFromRegistrationCtx(ctx))
}

export const INVOICE_UNDERPAYMENT_EMAIL_TEMPLATE_KEY =
  'invoice_underpayment' satisfies EmailTemplateKey

export const REGISTRATION_INVOICE_EMAIL_TEMPLATE_KEY = 'invoice' satisfies EmailTemplateKey
