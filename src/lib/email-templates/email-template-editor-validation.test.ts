import { EmailTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { analyzeEmailTemplateBlocks } from '@/lib/email-templates/email-template-editor-validation'

describe('analyzeEmailTemplateBlocks', () => {
  it('does not throw for default invoice blocks with placeholder chips', () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.invoice_underpayment)
    expect(() =>
      analyzeEmailTemplateBlocks(
        EmailTemplateKey.invoice_underpayment,
        entry.defaultSubject,
        entry.defaultBlocks,
      ),
    ).not.toThrow()
    const result = analyzeEmailTemplateBlocks(
      EmailTemplateKey.invoice_underpayment,
      entry.defaultSubject,
      entry.defaultBlocks,
    )
    expect(result.missingRequired).toEqual([])
  })
})
