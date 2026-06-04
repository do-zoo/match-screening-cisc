import type { EmailTemplateKey } from '@prisma/client'

import { CLUB_EMAIL_DEFAULT_BODIES } from '@/lib/email-templates/default-bodies'
import { applyEmailPlaceholders } from '@/lib/email-templates/email-placeholder'
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

function varsFromCtx(ctx: InvoiceEmailCtx): Record<string, string> {
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

function safeApply(
  subject: string,
  body: string,
  vars: Record<string, string>,
  fallback: () => { subject: string; text: string },
): { subject: string; text: string } {
  try {
    return {
      subject: applyEmailPlaceholders(subject, vars),
      text: applyEmailPlaceholders(body, vars),
    }
  } catch {
    return fallback()
  }
}

export function renderInvoiceUnderpaymentEmail(
  fromDb: { subject: string; body: string } | null,
  ctx: InvoiceEmailCtx,
): { subject: string; text: string } {
  const vars = varsFromCtx(ctx)
  const defaults = CLUB_EMAIL_DEFAULT_BODIES.invoice_underpayment
  const fallback = () =>
    safeApply(defaults.subject, defaults.body, vars, () => ({
      subject: defaults.subject.replace('{event_title}', ctx.eventTitle),
      text: defaults.body,
    }))

  if (!fromDb) return fallback()
  return safeApply(fromDb.subject, fromDb.body, vars, fallback)
}

export const INVOICE_EMAIL_TEMPLATE_KEY = 'invoice_underpayment' satisfies EmailTemplateKey
