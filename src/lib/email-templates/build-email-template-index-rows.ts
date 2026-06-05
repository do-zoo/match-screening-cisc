import type { EmailTemplateKey } from '@prisma/client'

import {
  EMAIL_TEMPLATE_KEYS_ORDERED,
  getEmailTemplateEntry,
} from '@/lib/email-templates/email-template-catalog'

export type EmailTemplateIndexRow = {
  key: EmailTemplateKey
  label: string
  description: string
  isCustomized: boolean
  updatedAtIso: string | null
}

export function buildEmailTemplateIndexRows(
  customizedKeys: Set<EmailTemplateKey>,
  updatedAtByKey: Partial<Record<EmailTemplateKey, Date>>,
): EmailTemplateIndexRow[] {
  return EMAIL_TEMPLATE_KEYS_ORDERED.map(key => {
    const entry = getEmailTemplateEntry(key)
    return {
      key,
      label: entry.labelId,
      description: entry.descriptionId,
      isCustomized: customizedKeys.has(key),
      updatedAtIso: updatedAtByKey[key]?.toISOString() ?? null,
    }
  })
}
