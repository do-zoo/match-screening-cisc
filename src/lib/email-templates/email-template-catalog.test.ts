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

  it('orders templates by sortOrder', () => {
    const orders = EMAIL_TEMPLATE_KEYS_ORDERED.map(k => EMAIL_TEMPLATE_CATALOG[k].sortOrder)
    expect(orders).toEqual([...orders].toSorted((a, b) => a - b))
  })

  it('registration approved default has event_schedule before registration_receipt', () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.registration_approved)
    const scheduleIndex = entry.defaultBlocks.findIndex(b => b.type === 'event_schedule')
    const receiptIndex = entry.defaultBlocks.findIndex(b => b.type === 'registration_receipt')
    expect(scheduleIndex).toBeGreaterThanOrEqual(0)
    expect(receiptIndex).toBeGreaterThan(scheduleIndex)
    expect(entry.requiredTokens).toContain('registration_id')
  })

  it('underpayment invoice default has bank_details block', () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice_underpayment)
    expect(entry.defaultBlocks.some(b => b.type === 'bank_details')).toBe(true)
  })

  it('magic link and admin invite have cta_button', () => {
    expect(getEmailTemplateEntry(EmailTemplateKey.magic_link).defaultBlocks.some(b => b.type === 'cta_button')).toBe(
      true,
    )
    expect(getEmailTemplateEntry(EmailTemplateKey.admin_invite).defaultBlocks.some(b => b.type === 'cta_button')).toBe(
      true,
    )
  })

  it('rejected requires reason token', () => {
    expect(getEmailTemplateEntry(EmailTemplateKey.rejected).requiredTokens).toContain('reason')
  })
})
