import { EmailTemplateKey } from '@prisma/client'

import { sendRegistrationEmailByKey, type SendRegistrationEmailResult } from '@/lib/email/send-registration-email'

export type SendRegistrationApprovedEmailResult = SendRegistrationEmailResult

export async function sendRegistrationApprovedEmailForRegistration(opts: {
  registrationId: string
  eventId: string
  actorAuthUserId: string
  actorProfileId: string | null
}): Promise<SendRegistrationApprovedEmailResult> {
  return sendRegistrationEmailByKey({
    ...opts,
    templateKey: EmailTemplateKey.registration_approved,
  })
}
