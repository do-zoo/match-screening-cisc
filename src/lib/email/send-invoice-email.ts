import { EmailTemplateKey } from '@prisma/client'

import { sendRegistrationEmailByKey, type SendRegistrationEmailResult } from '@/lib/email/send-registration-email'

export type SendInvoiceEmailResult = SendRegistrationEmailResult

export async function sendInvoiceEmailForRegistration(opts: {
  registrationId: string
  eventId: string
  actorAuthUserId: string
  actorProfileId: string | null
}): Promise<SendInvoiceEmailResult> {
  return sendRegistrationEmailByKey({
    ...opts,
    templateKey: EmailTemplateKey.invoice_underpayment,
  })
}
