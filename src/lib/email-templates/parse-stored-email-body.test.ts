import { EmailTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { parseStoredEmailBody, serializeStoredBody } from '@/lib/email-templates/parse-stored-email-body'

describe('parseStoredEmailBody', () => {
  it('round-trips serialized v1 body', () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice_underpayment)
    const raw = serializeStoredBody({ v: 1, blocks: entry.defaultBlocks })
    const blocks = parseStoredEmailBody(EmailTemplateKey.invoice_underpayment, raw)
    expect(blocks.length).toBe(entry.defaultBlocks.length)
    expect(blocks.some(b => b.type === 'bank_details')).toBe(true)
  })

  it('migrates legacy plain string', () => {
    const blocks = parseStoredEmailBody(EmailTemplateKey.magic_link, 'Halo admin\n\nParagraf dua')
    expect(blocks.length).toBeGreaterThan(0)
  })
})
