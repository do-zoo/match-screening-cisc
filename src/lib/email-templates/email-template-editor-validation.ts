import { EmailTemplateKey } from '@prisma/client'

import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { collectTokensFromDoc } from '@/lib/email-templates/email-doc-serializer'
import { EMAIL_PLACEHOLDER_TOKEN } from '@/lib/email-templates/email-placeholder'
import {
  allTokensForKey,
  getEmailTemplateEntry,
} from '@/lib/email-templates/email-template-catalog'

const IMPLICIT_BLOCK_TOKENS: Partial<
  Record<EmailTemplateKey, Partial<Record<EmailBlock['type'], readonly string[]>>>
> = {
  [EmailTemplateKey.invoice]: {
    invoice_summary: ['event_title', 'total_amount_idr'],
    bank_details: ['bank_name', 'account_number', 'account_name'],
  },
  [EmailTemplateKey.invoice_underpayment]: {
    invoice_summary: ['event_title', 'adjustment_amount_idr'],
    bank_details: ['bank_name', 'account_number', 'account_name'],
  },
  [EmailTemplateKey.registration_approved]: {
    registration_receipt: ['registration_id', 'computed_total_idr'],
    event_schedule: ['event_title', 'venue', 'venue_address', 'venue_map_url', 'start_at_formatted'],
  },
}

function collectPlaceholderNames(text: string): string[] {
  const re = new RegExp(EMAIL_PLACEHOLDER_TOKEN.source, EMAIL_PLACEHOLDER_TOKEN.flags)
  return [...text.matchAll(re)].map(m => m[1]!)
}

function tokensFromBlocks(key: EmailTemplateKey, subject: string, blocks: EmailBlock[]): Set<string> {
  const found = new Set(collectPlaceholderNames(subject))

  for (const block of blocks) {
    if (block.type === 'paragraph') {
      for (const t of collectTokensFromDoc(block.doc)) found.add(t)
    }
    if (block.type === 'cta_button' && block.href?.trim()) {
      for (const t of collectPlaceholderNames(block.href)) found.add(t)
    }
    const implicit = IMPLICIT_BLOCK_TOKENS[key]?.[block.type]
    if (implicit) {
      for (const t of implicit) found.add(t)
    }
  }

  return found
}

export function analyzeEmailTemplateBlocks(
  key: EmailTemplateKey,
  subject: string,
  blocks: EmailBlock[],
): { missingRequired: string[]; invalidTokens: string[] } {
  const entry = getEmailTemplateEntry(key)
  const allowed = allTokensForKey(key)
  const found = tokensFromBlocks(key, subject, blocks)

  const missingRequired = entry.requiredTokens.filter(t => !found.has(t))
  const invalidTokens = [...found].filter(t => !allowed.has(t))

  return { missingRequired, invalidTokens }
}

export function validateEmailTemplateBlocks(
  key: EmailTemplateKey,
  subject: string,
  blocks: EmailBlock[],
): string | null {
  const subjectTrim = subject.trim()
  if (subjectTrim.length === 0) return 'Subjek tidak boleh kosong.'

  const paragraphCount = blocks.filter(b => b.type === 'paragraph').length
  if (paragraphCount < 1) return 'Minimal satu blok paragraf diperlukan.'

  if (
    (key === EmailTemplateKey.magic_link || key === EmailTemplateKey.admin_invite) &&
    !blocks.some(b => b.type === 'cta_button')
  ) {
    return 'Template ini harus memiliki tombol CTA.'
  }

  if (
    (key === EmailTemplateKey.invoice || key === EmailTemplateKey.invoice_underpayment) &&
    !blocks.some(b => b.type === 'bank_details')
  ) {
    return 'Template tagihan harus memiliki blok rekening.'
  }

  if (
    (key === EmailTemplateKey.invoice || key === EmailTemplateKey.invoice_underpayment) &&
    !blocks.some(b => b.type === 'invoice_summary')
  ) {
    return 'Template tagihan harus memiliki blok ringkasan tagihan.'
  }

  if (
    key === EmailTemplateKey.registration_approved &&
    !blocks.some(b => b.type === 'registration_receipt')
  ) {
    return 'Template konfirmasi pembayaran harus memiliki blok ringkasan pesanan.'
  }

  const { missingRequired, invalidTokens } = analyzeEmailTemplateBlocks(key, subjectTrim, blocks)
  if (missingRequired.length > 0) {
    return `Placeholder wajib tidak ditemukan: ${missingRequired.map(t => `{${t}}`).join(', ')}`
  }
  if (invalidTokens.length > 0) {
    return `Placeholder tidak dikenal: ${invalidTokens.map(t => `{${t}}`).join(', ')}`
  }

  return null
}
