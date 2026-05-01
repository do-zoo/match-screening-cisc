import type { WaTemplateKey } from "@prisma/client";

import { formatWaIdr } from "@/lib/wa-templates/format-wa-idr";
import type {
  RegistrationMessageCtx,
  UnderpaymentInvoiceCtx,
} from "@/lib/wa-templates/messages";
import {
  templateApproved,
  templateCancelled,
  templatePaymentIssue,
  templateReceipt,
  templateRejected,
  templateRefunded,
  templateUnderpaymentInvoice,
} from "@/lib/wa-templates/messages";
import { applyWaPlaceholders } from "@/lib/wa-templates/wa-placeholder";

export type ClubWaBodies = Partial<Record<WaTemplateKey, string | null>>;

function safeApply(
  body: string | null | undefined,
  vars: Record<string, string>,
  fallback: () => string,
): string {
  const t = typeof body === "string" ? body.trim() : "";
  if (!t) return fallback();
  try {
    return applyWaPlaceholders(t, vars);
  } catch {
    return fallback();
  }
}

export function renderReceiptMessage(
  bodyFromDb: string | null | undefined,
  ctx: RegistrationMessageCtx,
): string {
  return safeApply(bodyFromDb, {
    contact_name: ctx.contactName,
    event_title: ctx.eventTitle,
    registration_id: ctx.registrationId,
    computed_total_idr: formatWaIdr(ctx.computedTotalIdr),
  }, () => templateReceipt(ctx));
}

export function renderApprovedMessage(
  bodyFromDb: string | null | undefined,
  eventTitle: string,
  venue: string,
  startAtIso: string,
): string {
  const when = new Date(startAtIso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "long",
    timeStyle: "short",
  });
  return safeApply(
    bodyFromDb,
    {
      event_title: eventTitle,
      venue,
      start_at_formatted: when,
    },
    () => templateApproved(eventTitle, venue, startAtIso),
  );
}

export function renderRejectedMessage(
  bodyFromDb: string | null | undefined,
  reason: string,
): string {
  return safeApply(bodyFromDb, { reason }, () =>
    templateRejected(reason),
  );
}

export function renderPaymentIssueMessage(
  bodyFromDb: string | null | undefined,
  reason: string,
): string {
  return safeApply(bodyFromDb, { reason }, () =>
    templatePaymentIssue(reason),
  );
}

export function renderCancelledMessage(
  bodyFromDb: string | null | undefined,
  contactName: string,
  eventTitle: string,
): string {
  return safeApply(bodyFromDb, {
    contact_name: contactName,
    event_title: eventTitle,
  }, () => templateCancelled(contactName, eventTitle));
}

export function renderRefundedMessage(
  bodyFromDb: string | null | undefined,
  contactName: string,
  eventTitle: string,
): string {
  return safeApply(bodyFromDb, {
    contact_name: contactName,
    event_title: eventTitle,
  }, () => templateRefunded(contactName, eventTitle));
}

export function renderUnderpaymentInvoiceMessage(
  bodyFromDb: string | null | undefined,
  c: UnderpaymentInvoiceCtx,
): string {
  return safeApply(
    bodyFromDb,
    {
      contact_name: c.contactName,
      event_title: c.eventTitle,
      adjustment_amount_idr: formatWaIdr(c.adjustmentAmountIdr),
      bank_name: c.bankName,
      account_number: c.accountNumber,
      account_name: c.accountName,
    },
    () => templateUnderpaymentInvoice(c),
  );
}
