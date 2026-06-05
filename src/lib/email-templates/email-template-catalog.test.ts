import { EmailTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
  EMAIL_TEMPLATE_CATALOG,
  EMAIL_TEMPLATE_KEYS_ORDERED,
  getEmailTemplateEntry,
} from '@/lib/email-templates/email-template-catalog'

describe('EMAIL_TEMPLATE_CATALOG', () => {
  const enumKeys = Object.values(EmailTemplateKey).filter(v => typeof v === 'string') as EmailTemplateKey[]

  it('covers every EmailTemplateKey', () => {
    expect(new Set(enumKeys)).toEqual(new Set(Object.keys(EMAIL_TEMPLATE_CATALOG)))
  })

  it('orders invoice templates then magic_link', () => {
    expect(EMAIL_TEMPLATE_KEYS_ORDERED).toEqual([
      EmailTemplateKey.invoice,
      EmailTemplateKey.invoice_underpayment,
      EmailTemplateKey.registration_approved,
      EmailTemplateKey.magic_link,
    ])
  })

  it('registration approved default has registration_receipt block', () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.registration_approved)
    expect(entry.defaultBlocks.some(b => b.type === 'registration_receipt')).toBe(true)
    expect(entry.requiredTokens).toContain('registration_id')
  })

  it('underpayment invoice default has bank_details block', () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice_underpayment)
    expect(entry.defaultBlocks.some(b => b.type === 'bank_details')).toBe(true)
    expect(entry.defaultBlocks.filter(b => b.type === 'paragraph').length).toBeGreaterThan(0)
  })

  it('magic link default has cta_button', () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.magic_link)
    expect(entry.defaultBlocks.some(b => b.type === 'cta_button')).toBe(true)
  })
})
