import { EmailTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { CLUB_EMAIL_LEGACY_PLAIN } from '@/lib/email-templates/legacy-plain-bodies'
import { migratePlainBodyToBlocks } from '@/lib/email-templates/migrate-plain-email-body'

describe('migratePlainBodyToBlocks', () => {
  it('splits registration invoice legacy body into paragraphs and keeps bank_details', () => {
    const blocks = migratePlainBodyToBlocks(
      EmailTemplateKey.invoice,
      CLUB_EMAIL_LEGACY_PLAIN.invoice,
    )
    expect(blocks.some(b => b.type === 'bank_details')).toBe(true)
    expect(blocks.filter(b => b.type === 'paragraph').length).toBeGreaterThanOrEqual(1)
  })

  it('splits underpayment invoice legacy body into paragraphs and keeps bank_details', () => {
    const blocks = migratePlainBodyToBlocks(
      EmailTemplateKey.invoice_underpayment,
      CLUB_EMAIL_LEGACY_PLAIN.invoice_underpayment,
    )
    expect(blocks.some(b => b.type === 'bank_details')).toBe(true)
    expect(blocks.filter(b => b.type === 'paragraph').length).toBeGreaterThanOrEqual(1)
    const opening = blocks.find(b => b.type === 'paragraph')
    expect(opening && opening.type === 'paragraph').toBe(true)
    if (opening?.type === 'paragraph') {
      expect(JSON.stringify(opening.doc)).toContain('contact_name')
    }
  })

  it('magic link strips url line from paragraphs', () => {
    const blocks = migratePlainBodyToBlocks(EmailTemplateKey.magic_link, CLUB_EMAIL_LEGACY_PLAIN.magic_link)
    const paragraphs = blocks.filter(b => b.type === 'paragraph')
    for (const p of paragraphs) {
      if (p.type === 'paragraph') {
        expect(JSON.stringify(p.doc)).not.toContain('magic_link_url')
      }
    }
    expect(blocks.some(b => b.type === 'cta_button')).toBe(true)
  })
})
