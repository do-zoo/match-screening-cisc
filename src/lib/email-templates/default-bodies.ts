import { EmailTemplateKey } from '@prisma/client'

import {
  EMAIL_TEMPLATE_CATALOG,
  EMAIL_TEMPLATE_KEYS_ORDERED,
} from '@/lib/email-templates/email-template-catalog'
import { serializeStoredBody } from '@/lib/email-templates/parse-stored-email-body'

export type EmailTemplateDefaults = { subject: string; body: string }

function defaultsForKey(key: EmailTemplateKey): EmailTemplateDefaults {
  const entry = EMAIL_TEMPLATE_CATALOG[key]
  return {
    subject: entry.defaultSubject,
    body: serializeStoredBody({
      v: 1,
      blocks: entry.defaultBlocks,
    }),
  }
}

export const CLUB_EMAIL_DEFAULT_BODIES: Record<EmailTemplateKey, EmailTemplateDefaults> =
  Object.fromEntries(EMAIL_TEMPLATE_KEYS_ORDERED.map(key => [key, defaultsForKey(key)])) as Record<
    EmailTemplateKey,
    EmailTemplateDefaults
  >
