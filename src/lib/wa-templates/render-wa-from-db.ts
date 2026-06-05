import { WaTemplateKey } from '@prisma/client'

import type { RegistrationMessageCtx, UnderpaymentInvoiceCtx } from '@/lib/wa-templates/messages'
import {
  templateApproved,
  templateCancelled,
  templatePaymentIssue,
  templateReceipt,
  templateRejected,
  templateRefunded,
  templateUnderpaymentInvoice,
} from '@/lib/wa-templates/messages'
import { applyWaPlaceholders } from '@/lib/wa-templates/wa-placeholder'
import {
  buildWaTemplateVars,
  registrationNotifyToWaContext,
  type WaTemplateRenderContext,
} from '@/lib/wa-templates/wa-template-vars'

export type ClubWaBodies = Partial<Record<WaTemplateKey, string | null>>

export { registrationNotifyToWaContext, type WaTemplateRenderContext }

function safeApply(
  key: WaTemplateKey,
  body: string | null | undefined,
  ctx: WaTemplateRenderContext,
  fallback: () => string,
): string {
  const t = typeof body === 'string' ? body.trim() : ''
  if (!t) return fallback()
  try {
    return applyWaPlaceholders(t, buildWaTemplateVars(key, ctx))
  } catch {
    return fallback()
  }
}

export function renderWaMessageFromDb(
  key: WaTemplateKey,
  bodyFromDb: string | null | undefined,
  ctx: WaTemplateRenderContext,
  fallback: () => string,
): string {
  return safeApply(key, bodyFromDb, ctx, fallback)
}

export function renderReceiptMessage(bodyFromDb: string | null | undefined, ctx: RegistrationMessageCtx): string {
  return renderWaMessageFromDb(
    WaTemplateKey.receipt,
    bodyFromDb,
    {
      contactName: ctx.contactName,
      eventTitle: ctx.eventTitle,
      registrationId: ctx.registrationId,
      computedTotalIdr: ctx.computedTotalIdr,
    },
    () => templateReceipt(ctx),
  )
}

export function renderApprovedMessage(
  bodyFromDb: string | null | undefined,
  ctx: WaTemplateRenderContext,
): string {
  return renderWaMessageFromDb(WaTemplateKey.approved, bodyFromDb, ctx, () =>
    templateApproved(ctx.eventTitle ?? '', ctx.venue ?? '', ctx.kickOffAtIso ?? ''),
  )
}

/** @deprecated Prefer `renderApprovedMessage(body, ctx)` — kept for call sites migrating gradually. */
export function renderApprovedMessageLegacy(
  bodyFromDb: string | null | undefined,
  eventTitle: string,
  venue: string,
  startAtIso: string,
  extra?: Omit<WaTemplateRenderContext, 'eventTitle' | 'venue' | 'kickOffAtIso'>,
): string {
  return renderApprovedMessage(bodyFromDb, {
    ...extra,
    eventTitle,
    venue,
    kickOffAtIso: startAtIso,
  })
}

export function renderRejectedMessage(
  bodyFromDb: string | null | undefined,
  ctx: WaTemplateRenderContext,
): string {
  return renderWaMessageFromDb(WaTemplateKey.rejected, bodyFromDb, ctx, () =>
    templateRejected(ctx.reason ?? ''),
  )
}

export function renderPaymentIssueMessage(
  bodyFromDb: string | null | undefined,
  ctx: WaTemplateRenderContext,
): string {
  return renderWaMessageFromDb(WaTemplateKey.payment_issue, bodyFromDb, ctx, () =>
    templatePaymentIssue(ctx.reason ?? ''),
  )
}

export function renderCancelledMessage(bodyFromDb: string | null | undefined, ctx: WaTemplateRenderContext): string {
  return renderWaMessageFromDb(WaTemplateKey.cancelled, bodyFromDb, ctx, () =>
    templateCancelled(ctx.contactName ?? '', ctx.eventTitle ?? ''),
  )
}

export function renderRefundedMessage(bodyFromDb: string | null | undefined, ctx: WaTemplateRenderContext): string {
  return renderWaMessageFromDb(WaTemplateKey.refunded, bodyFromDb, ctx, () =>
    templateRefunded(ctx.contactName ?? '', ctx.eventTitle ?? ''),
  )
}

export function renderUnderpaymentInvoiceMessage(
  bodyFromDb: string | null | undefined,
  c: UnderpaymentInvoiceCtx,
): string {
  return renderWaMessageFromDb(
    WaTemplateKey.underpayment_invoice,
    bodyFromDb,
    {
      contactName: c.contactName,
      eventTitle: c.eventTitle,
      adjustmentAmountIdr: c.adjustmentAmountIdr,
      bankName: c.bankName,
      accountNumber: c.accountNumber,
      accountName: c.accountName,
    },
    () => templateUnderpaymentInvoice(c),
  )
}
