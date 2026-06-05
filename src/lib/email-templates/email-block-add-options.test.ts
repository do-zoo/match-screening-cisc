import { EmailTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
  addEmailBlock,
  addableBlockTypesForTemplate,
  listEmailBlockAddOptions,
} from '@/lib/email-templates/email-block-add-options'
import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'

describe('addableBlockTypesForTemplate', () => {
  it('registration_approved includes ringkasan acara, pesanan, and tombol', () => {
    expect(addableBlockTypesForTemplate(EmailTemplateKey.registration_approved)).toEqual([
      'paragraph',
      'hr',
      'event_schedule',
      'registration_receipt',
      'cta_button',
      'footer_disclaimer',
    ])
  })

  it('otp excludes tombol', () => {
    expect(addableBlockTypesForTemplate(EmailTemplateKey.otp)).not.toContain('cta_button')
  })

  it('invoice includes tagihan blocks', () => {
    expect(addableBlockTypesForTemplate(EmailTemplateKey.invoice)).toContain('invoice_summary')
    expect(addableBlockTypesForTemplate(EmailTemplateKey.invoice)).toContain('bank_details')
  })
})

describe('addEmailBlock', () => {
  it('inserts event_schedule before registration_receipt', () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.registration_approved)
    const blocks = entry.defaultBlocks.filter(b => b.type !== 'event_schedule')
    const next = addEmailBlock(blocks, EmailTemplateKey.registration_approved, 'event_schedule')
    const scheduleIndex = next.findIndex(b => b.type === 'event_schedule')
    const receiptIndex = next.findIndex(b => b.type === 'registration_receipt')
    expect(scheduleIndex).toBeGreaterThanOrEqual(0)
    expect(receiptIndex).toBeGreaterThan(scheduleIndex)
  })

  it('does not duplicate singleton blocks', () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.registration_approved)
    const next = addEmailBlock(entry.defaultBlocks, EmailTemplateKey.registration_approved, 'event_schedule')
    expect(next.filter(b => b.type === 'event_schedule')).toHaveLength(1)
  })

  it('can add multiple hr blocks', () => {
    const once = addEmailBlock([], EmailTemplateKey.registration_approved, 'hr')
    const twice = addEmailBlock(once, EmailTemplateKey.registration_approved, 'hr')
    expect(twice.filter(b => b.type === 'hr')).toHaveLength(2)
  })

  it('creates cta_button with default event_page_url href', () => {
    const next = addEmailBlock([], EmailTemplateKey.registration_approved, 'cta_button')
    const cta = next.find(b => b.type === 'cta_button')
    expect(cta?.type === 'cta_button' && cta.href).toBe('{event_page_url}')
  })
})

describe('listEmailBlockAddOptions', () => {
  it('marks singleton blocks as already added', () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.registration_approved)
    const options = listEmailBlockAddOptions(EmailTemplateKey.registration_approved, entry.defaultBlocks)
    expect(options.find(o => o.type === 'event_schedule')?.alreadyAdded).toBe(true)
    expect(options.find(o => o.type === 'paragraph')?.alreadyAdded).toBe(false)
  })
})
