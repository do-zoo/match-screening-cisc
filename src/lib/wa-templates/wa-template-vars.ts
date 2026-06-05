import type { WaTemplateKey } from '@prisma/client'

import { formatWaIdr } from '@/lib/wa-templates/format-wa-idr'
import { allTokensForKey } from '@/lib/wa-templates/wa-template-catalog'

export type WaTemplateRenderContext = {
  contactName?: string
  contactWhatsapp?: string
  registrationId?: string
  computedTotalIdr?: number
  ticketQty?: number
  ticketCategoryName?: string
  eventTitle?: string
  venue?: string
  kickOffAtIso?: string
  openGateAtIso?: string | null
  reason?: string
  adjustmentAmountIdr?: number
  bankName?: string
  accountNumber?: string
  accountName?: string
}

function formatWaDate(iso: string | undefined | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

const TOKEN_RESOLVERS: Record<string, (ctx: WaTemplateRenderContext) => string> = {
  contact_name: ctx => ctx.contactName ?? '',
  contact_whatsapp: ctx => ctx.contactWhatsapp ?? '',
  registration_id: ctx => ctx.registrationId ?? '',
  computed_total_idr: ctx =>
    ctx.computedTotalIdr !== undefined ? formatWaIdr(ctx.computedTotalIdr) : '',
  ticket_qty: ctx => (ctx.ticketQty !== undefined ? String(ctx.ticketQty) : ''),
  ticket_category_name: ctx => ctx.ticketCategoryName ?? '',
  event_title: ctx => ctx.eventTitle ?? '',
  venue: ctx => ctx.venue ?? '',
  start_at_formatted: ctx => formatWaDate(ctx.kickOffAtIso),
  open_gate_at_formatted: ctx => formatWaDate(ctx.openGateAtIso),
  reason: ctx => ctx.reason ?? '',
  adjustment_amount_idr: ctx =>
    ctx.adjustmentAmountIdr !== undefined ? formatWaIdr(ctx.adjustmentAmountIdr) : '',
  bank_name: ctx => ctx.bankName ?? '',
  account_number: ctx => ctx.accountNumber ?? '',
  account_name: ctx => ctx.accountName ?? '',
}

/** Build substitution map for every allowed token on this template key. */
export function buildWaTemplateVars(
  key: WaTemplateKey,
  ctx: WaTemplateRenderContext,
): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const token of allTokensForKey(key)) {
    const resolve = TOKEN_RESOLVERS[token]
    vars[token] = resolve ? resolve(ctx) : ''
  }
  return vars
}

export function registrationNotifyToWaContext(
  r: {
    contactName: string
    contactWhatsapp: string
    registrationId: string
    computedTotalIdr: number
    ticketQty: number
    ticketCategoryName: string
    rejectionReason: string | null
    paymentIssueReason: string | null
    event: {
      title: string
      venueName: string
      kickOffAt: Date
      openGateAt: Date | null
    }
    bank?: { bankName: string; accountNumber: string; accountName: string }
    adjustmentAmountIdr?: number
  },
  reasonOverride?: string,
): WaTemplateRenderContext {
  return {
    contactName: r.contactName,
    contactWhatsapp: r.contactWhatsapp,
    registrationId: r.registrationId,
    computedTotalIdr: r.computedTotalIdr,
    ticketQty: r.ticketQty,
    ticketCategoryName: r.ticketCategoryName,
    eventTitle: r.event.title,
    venue: r.event.venueName,
    kickOffAtIso: r.event.kickOffAt.toISOString(),
    openGateAtIso: r.event.openGateAt?.toISOString() ?? null,
    reason:
      reasonOverride ??
      r.rejectionReason?.trim() ??
      r.paymentIssueReason?.trim() ??
      undefined,
    adjustmentAmountIdr: r.adjustmentAmountIdr,
    bankName: r.bank?.bankName,
    accountNumber: r.bank?.accountNumber,
    accountName: r.bank?.accountName,
  }
}
