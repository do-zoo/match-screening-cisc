import type { EmailTemplateKey } from '@prisma/client'

import { isStoredEmailTemplateBody } from '@/lib/email-templates/email-block-types'
import { EMAIL_PLACEHOLDER_TOKEN } from '@/lib/email-templates/email-placeholder'
import { EMAIL_TEMPLATE_KEYS_ORDERED, getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { validateEmailTemplateBlocks } from '@/lib/email-templates/email-template-editor-validation'
import { parseStoredEmailBody } from '@/lib/email-templates/parse-stored-email-body'

export const REQUIRED_EMAIL_TOKENS: Record<EmailTemplateKey, readonly string[]> = Object.fromEntries(
  EMAIL_TEMPLATE_KEYS_ORDERED.map(key => [key, getEmailTemplateEntry(key).requiredTokens]),
) as Record<EmailTemplateKey, readonly string[]>

function collectPlaceholderNames(text: string): string[] {
  const re = new RegExp(EMAIL_PLACEHOLDER_TOKEN.source, EMAIL_PLACEHOLDER_TOKEN.flags)
  return [...text.matchAll(re)].map(m => m[1]!)
}

/** @deprecated Prefer validateEmailTemplateBlocks for block JSON bodies. */
export function validateEmailTemplate(key: EmailTemplateKey, subject: string, body: string): string | null {
  const trimmed = body.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (isStoredEmailTemplateBody(parsed)) {
        return validateEmailTemplateBlocks(key, subject, parsed.blocks)
      }
    } catch {
      return 'Format templat tidak valid.'
    }
  }

  const subjectTrim = subject.trim()
  const bodyTrim = body.trim()
  if (subjectTrim.length === 0) return 'Subjek tidak boleh kosong.'
  if (bodyTrim.length === 0) return 'Isi templat tidak boleh kosong.'

  const required = REQUIRED_EMAIL_TOKENS[key]
  const combined = `${subjectTrim}\n${bodyTrim}`
  const found = new Set(collectPlaceholderNames(combined))
  for (const token of required) {
    if (!found.has(token)) {
      return `Placeholder wajib tidak ditemukan: {${token}}`
    }
  }
  return null
}

export function validateEmailTemplateBodyField(
  key: EmailTemplateKey,
  subject: string,
  body: string,
): string | null {
  const blocks = parseStoredEmailBody(key, body)
  return validateEmailTemplateBlocks(key, subject, blocks)
}
