import type { EmailTemplateKey } from '@prisma/client'

import type { EmailBlock, StoredEmailTemplateBody } from '@/lib/email-templates/email-block-types'
import { isStoredEmailTemplateBody } from '@/lib/email-templates/email-block-types'
import { migratePlainBodyToBlocks } from '@/lib/email-templates/migrate-plain-email-body'

export function serializeStoredBody(body: StoredEmailTemplateBody): string {
  return JSON.stringify(body)
}

export function parseStoredEmailBody(key: EmailTemplateKey, raw: string): EmailBlock[] {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return migratePlainBodyToBlocks(key, '')
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (isStoredEmailTemplateBody(parsed)) {
      return parsed.blocks
    }
  } catch {
    /* legacy plain text */
  }

  return migratePlainBodyToBlocks(key, raw)
}
