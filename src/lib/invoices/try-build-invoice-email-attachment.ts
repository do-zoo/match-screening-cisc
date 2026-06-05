import { EmailTemplateKey } from '@prisma/client'

import { loadRegistrationInvoicePdfData } from './registration-invoice-pdf-data'
import { renderRegistrationInvoicePdf } from './render-registration-invoice-pdf'
import type { InvoicePdfKind } from './registration-invoice-pdf-types'

/** Template registrasi yang melampirkan PDF tagihan/bukti (satu generator `registration` | `adjustment`). */
export const REGISTRATION_EMAIL_PDF_ATTACHMENT_KEYS: ReadonlySet<EmailTemplateKey> = new Set([
  EmailTemplateKey.invoice,
  EmailTemplateKey.invoice_underpayment,
  EmailTemplateKey.receipt,
  EmailTemplateKey.registration_approved,
])

function pdfKindForEmailTemplate(templateKey: EmailTemplateKey): InvoicePdfKind | null {
  if (!REGISTRATION_EMAIL_PDF_ATTACHMENT_KEYS.has(templateKey)) return null
  return templateKey === EmailTemplateKey.invoice_underpayment ? 'adjustment' : 'registration'
}

export async function tryBuildInvoiceEmailAttachment(input: {
  eventId: string
  registrationId: string
  templateKey: EmailTemplateKey
  unpaidAdjustmentId?: string | null
}): Promise<{ filename: string; content: Buffer } | null> {
  const kind = pdfKindForEmailTemplate(input.templateKey)
  if (!kind) return null

  try {
    const loaded = await loadRegistrationInvoicePdfData({
      eventId: input.eventId,
      registrationId: input.registrationId,
      kind,
      adjustmentId: kind === 'adjustment' ? (input.unpaidAdjustmentId ?? undefined) : undefined,
    })

    if (!loaded.ok) return null

    const rendered = await renderRegistrationInvoicePdf(loaded.data)
    return { filename: rendered.filename, content: rendered.buffer }
  } catch (e) {
    console.error('[tryBuildInvoiceEmailAttachment]', e)
    return null
  }
}
