import type { EmailTemplateKey } from '@prisma/client'

import { isStoredEmailTemplateBody } from '@/lib/email-templates/email-block-types'
import { EMAIL_PLACEHOLDER_TOKEN } from '@/lib/email-templates/email-placeholder'
import { validateEmailTemplateBlocks } from '@/lib/email-templates/email-template-editor-validation'
import { parseStoredEmailBody } from '@/lib/email-templates/parse-stored-email-body'

const INVOICE_UNDERPAYMENT_REQUIRED = [
  'contact_name',
  'event_title',
  'adjustment_amount_idr',
  'bank_name',
  'account_number',
  'account_name',
] as const

const INVOICE_REGISTRATION_REQUIRED = [
  'contact_name',
  'event_title',
  'total_amount_idr',
  'bank_name',
  'account_number',
  'account_name',
] as const

const REGISTRATION_APPROVED_REQUIRED = [
  'contact_name',
  'event_title',
  'registration_id',
  'computed_total_idr',
] as const

const MAGIC_LINK_REQUIRED = ['magic_link_url'] as const

export const REQUIRED_EMAIL_TOKENS: Record<EmailTemplateKey, readonly string[]> = {
  invoice: INVOICE_REGISTRATION_REQUIRED,
  invoice_underpayment: INVOICE_UNDERPAYMENT_REQUIRED,
  registration_approved: REGISTRATION_APPROVED_REQUIRED,
  magic_link: MAGIC_LINK_REQUIRED,
}

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
