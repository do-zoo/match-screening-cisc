import { WaTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { getWaTemplateEntry } from '@/lib/wa-templates/wa-template-catalog'
import { validateWaTemplateBody } from '@/lib/wa-templates/wa-template-policy'

describe('validateWaTemplateBody optional tokens', () => {
  it('allows optional token on approved', () => {
    const entry = getWaTemplateEntry(WaTemplateKey.approved)
    const body = `${entry.defaultBody}\nID: {registration_id}`
    expect(validateWaTemplateBody(WaTemplateKey.approved, body)).toBeNull()
  })

  it('rejects unknown token', () => {
    expect(
      validateWaTemplateBody(WaTemplateKey.rejected, 'Alasan: {reason}\nExtra: {unknown_token}'),
    ).toMatch(/tidak diperbolehkan/)
  })

  it('rejects missing required token', () => {
    expect(validateWaTemplateBody(WaTemplateKey.receipt, 'Halo {contact_name}')).toMatch(/wajib memuat/)
  })
})
