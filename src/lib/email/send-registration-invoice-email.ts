import { EmailTemplateKey } from '@prisma/client'

import { sendRegistrationEmailByKey, type SendRegistrationEmailResult } from '@/lib/email/send-registration-email'

export async function sendRegistrationInvoiceEmailForRegistration(opts: {
  registrationId: string
  eventId: string
  actorAuthUserId: string
  actorProfileId: string | null
}): Promise<SendRegistrationEmailResult> {
  return sendRegistrationEmailByKey({
    ...opts,
    templateKey: EmailTemplateKey.invoice,
  })
}
