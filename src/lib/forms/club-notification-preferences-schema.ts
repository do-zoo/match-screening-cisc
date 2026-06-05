import { z } from 'zod'

function formBoolean(value: unknown): boolean {
  return value === 'true' || value === true || value === 'on'
}

export const clubNotificationPreferencesSaveSchema = z.object({
  outboundMode: z.enum(['off', 'log_only', 'live']),
  outboundLabel: z
    .string()
    .optional()
    .transform(v => (v ?? '').trim())
    .transform(v => (v === '' ? '' : v.slice(0, 120))),
  emailAutoOnSubmitReceipt: z.preprocess(formBoolean, z.boolean()),
  emailAutoOnApprove: z.preprocess(formBoolean, z.boolean()),
  emailAutoOnReject: z.preprocess(formBoolean, z.boolean()),
  emailAutoOnPaymentIssue: z.preprocess(formBoolean, z.boolean()),
  emailAutoOnCancel: z.preprocess(formBoolean, z.boolean()),
  emailAutoOnRefund: z.preprocess(formBoolean, z.boolean()),
  emailAttachInvoicePdf: z.preprocess(formBoolean, z.boolean()),
})
