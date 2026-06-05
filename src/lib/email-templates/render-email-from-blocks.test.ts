import { EmailTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
  getEmailTemplateEntry,
  sampleVarsFromCatalog,
} from '@/lib/email-templates/email-template-catalog'
import { renderEmailFromBlocks } from '@/lib/email-templates/render-email-from-blocks'

describe('renderEmailFromBlocks', () => {
  it('registration approved html contains registration id', async () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.registration_approved)
    const { html, text } = await renderEmailFromBlocks({
      key: EmailTemplateKey.registration_approved,
      subject: entry.defaultSubject,
      blocks: entry.defaultBlocks,
      vars: sampleVarsFromCatalog(entry),
    })
    expect(html).toContain('clxyz123abc')
    expect(text).toContain('Rp850.000')
  })

  it('underpayment invoice html contains sample bank name', async () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice_underpayment)
    const { html, text } = await renderEmailFromBlocks({
      key: EmailTemplateKey.invoice_underpayment,
      subject: entry.defaultSubject,
      blocks: entry.defaultBlocks,
      vars: sampleVarsFromCatalog(entry),
    })
    expect(html).toContain('BCA')
    expect(text).toContain('Budi')
  })
})
