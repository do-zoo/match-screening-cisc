import type { WaTemplateKey } from "@prisma/client";

import { WA_PLACEHOLDER_TOKEN } from "@/lib/wa-templates/wa-placeholder";

const RECEIPT_REQUIRED = [
  "contact_name",
  "event_title",
  "registration_id",
  "computed_total_idr",
] as const;

const SINGLE_REASON = ["reason"] as const;

const TWO_NAME_EVENT = ["contact_name", "event_title"] as const;

const APPROVED_FIELDS = ["event_title", "venue", "start_at_formatted"] as const;

const UNDERPAY_FIELDS = [
  "contact_name",
  "event_title",
  "adjustment_amount_idr",
  "bank_name",
  "account_number",
  "account_name",
] as const;

/** Placeholder `{…}` yang wajib muncul paling tidak sekali dalam `body`. */
export const REQUIRED_TOKENS: Record<WaTemplateKey, readonly string[]> = {
  receipt: RECEIPT_REQUIRED,
  payment_issue: SINGLE_REASON,
  approved: APPROVED_FIELDS,
  rejected: SINGLE_REASON,
  cancelled: TWO_NAME_EVENT,
  refunded: TWO_NAME_EVENT,
  underpayment_invoice: UNDERPAY_FIELDS,
};

function collectPlaceholderNames(body: string): string[] {
  const re = new RegExp(WA_PLACEHOLDER_TOKEN.source, WA_PLACEHOLDER_TOKEN.flags);
  return [...body.matchAll(re)].map((m) => m[1]!);
}

export function validateWaTemplateBody(
  key: WaTemplateKey,
  body: string,
): string | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return "Isi templat tidak boleh kosong.";
  const names = new Set(collectPlaceholderNames(trimmed));
  const required = REQUIRED_TOKENS[key];
  for (const r of required) {
    if (!names.has(r))
      return `Templat wajib memuat placeholder {${r}}`;
  }
  const allowed = new Set<string>(required);
  for (const n of collectPlaceholderNames(trimmed)) {
    if (!allowed.has(n))
      return `Placeholder {${n}} tidak diperbolehkan untuk templat ini.`;
  }
  return null;
}
