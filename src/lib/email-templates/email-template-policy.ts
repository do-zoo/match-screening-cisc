import type { EmailTemplateKey } from '@prisma/client'

import { EMAIL_PLACEHOLDER_TOKEN } from '@/lib/email-templates/email-placeholder'

const INVOICE_REQUIRED = [
  'contact_name',
  'event_title',
  'adjustment_amount_idr',
  'bank_name',
  'account_number',
  'account_name',
] as const

const MAGIC_LINK_REQUIRED = ['magic_link_url'] as const

export const REQUIRED_EMAIL_TOKENS: Record<EmailTemplateKey, readonly string[]> = {
  invoice_underpayment: INVOICE_REQUIRED,
  magic_link: MAGIC_LINK_REQUIRED,
}

function collectPlaceholderNames(text: string): string[] {
  const re = new RegExp(EMAIL_PLACEHOLDER_TOKEN.source, EMAIL_PLACEHOLDER_TOKEN.flags)
  return [...text.matchAll(re)].map(m => m[1]!)
}

export function validateEmailTemplate(key: EmailTemplateKey, subject: string, body: string): string | null {
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
