import { EmailTemplateKey } from '@prisma/client'

import { CLUB_EMAIL_DEFAULT_BODIES } from '@/lib/email-templates/default-bodies'
import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { parseStoredEmailBody } from '@/lib/email-templates/parse-stored-email-body'
import { renderEmailFromBlocks } from '@/lib/email-templates/render-email-from-blocks'
import { loadPublicClubBranding } from '@/lib/public/load-club-branding'
import { formatWaIdr } from '@/lib/wa-templates/format-wa-idr'

export type InvoiceEmailCtx = {
  contactName: string
  eventTitle: string
  adjustmentAmountIdr: number
  bankName: string
  accountNumber: string
  accountName: string
  registrationId?: string
}

export type RegistrationInvoiceEmailCtx = {
  contactName: string
  eventTitle: string
  totalAmountIdr: number
  bankName: string
  accountNumber: string
  accountName: string
  registrationId?: string
}

function varsFromUnderpaymentCtx(ctx: InvoiceEmailCtx): Record<string, string> {
  const vars: Record<string, string> = {
    contact_name: ctx.contactName,
    event_title: ctx.eventTitle,
    adjustment_amount_idr: formatWaIdr(ctx.adjustmentAmountIdr),
    bank_name: ctx.bankName,
    account_number: ctx.accountNumber,
    account_name: ctx.accountName,
  }
  if (ctx.registrationId) vars.registration_id = ctx.registrationId
  return vars
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
  return vars
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
