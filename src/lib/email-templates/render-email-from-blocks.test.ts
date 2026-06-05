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

  it('includes contact email in html when branding contact set', async () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.magic_link)
    const { html, text } = await renderEmailFromBlocks({
      key: EmailTemplateKey.magic_link,
      subject: entry.defaultSubject,
      blocks: entry.defaultBlocks,
      vars: sampleVarsFromCatalog(entry),
      contact: {
        contactEmail: 'komite@example.com',
        websiteUrl: 'https://cisc.example',
        locationText: 'Tangerang Selatan',
        socialLinks: [{ label: 'Instagram', url: 'https://instagram.com/cisc' }],
      },
    })
    expect(html).toContain('komite@example.com')
    expect(html).toContain('Tangerang Selatan')
    expect(text).toContain('komite@example.com')
  })
})
