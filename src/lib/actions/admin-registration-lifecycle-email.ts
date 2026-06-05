'use server'

import { EmailTemplateKey } from '@prisma/client'

import { guardEvent, isAuthError } from '@/lib/actions/guard'
import { previewRegistrationEmailContent } from '@/lib/email/send-registration-email'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import type { RegistrationNotifyKind } from '@/lib/wa-templates/build-registration-notify'

const KIND_TO_KEY: Record<RegistrationNotifyKind, EmailTemplateKey | null> = {
  approved: EmailTemplateKey.registration_approved,
  rejected: EmailTemplateKey.rejected,
  payment_issue: EmailTemplateKey.payment_issue,
  cancelled: EmailTemplateKey.cancelled,
  refunded: EmailTemplateKey.refunded,
  underpayment_email_reminder: null,
}

export async function previewRegistrationCommsEmail(
  eventId: string,
  registrationId: string,
  kind: RegistrationNotifyKind,
): Promise<ActionResult<{ subject: string; textPreview: string } | null>> {
  try {
    await guardEvent(eventId)
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const key = KIND_TO_KEY[kind]
  if (!key) return ok(null)

  const preview = await previewRegistrationEmailContent({
    registrationId,
    eventId,
    templateKey: key,
  })

  if ('error' in preview) return ok(null)
  return ok({
    subject: preview.subject,
    textPreview: preview.text.slice(0, 600),
  })
}
