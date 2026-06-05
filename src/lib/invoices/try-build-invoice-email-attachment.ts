import { EmailTemplateKey } from '@prisma/client'

import { loadRegistrationInvoicePdfData } from './registration-invoice-pdf-data'
import { renderRegistrationInvoicePdf } from './render-registration-invoice-pdf'

export async function tryBuildInvoiceEmailAttachment(input: {
  eventId: string
  registrationId: string
  templateKey: EmailTemplateKey
  unpaidAdjustmentId?: string | null
}): Promise<{ filename: string; content: Buffer } | null> {
  if (
    input.templateKey !== EmailTemplateKey.invoice &&
    input.templateKey !== EmailTemplateKey.invoice_underpayment
  ) {
    return null
  }

  const kind = input.templateKey === EmailTemplateKey.invoice ? 'registration' : 'adjustment'

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
