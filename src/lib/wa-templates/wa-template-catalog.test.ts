import { WaTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
  WA_TEMPLATE_CATALOG,
  WA_TEMPLATE_KEYS_ORDERED,
  allowedTokensForKey,
  getWaTemplateEntry,
} from '@/lib/wa-templates/wa-template-catalog'
import { validateWaTemplateBody } from '@/lib/wa-templates/wa-template-policy'

describe('WA_TEMPLATE_CATALOG', () => {
  const enumKeys = Object.values(WaTemplateKey).filter(v => typeof v === 'string') as WaTemplateKey[]

  it('covers every WaTemplateKey', () => {
    expect(new Set(enumKeys)).toEqual(new Set(Object.keys(WA_TEMPLATE_CATALOG)))
  })

  it.each(enumKeys)('defaultBody for %s passes validateWaTemplateBody', key => {
    const entry = getWaTemplateEntry(key)
    expect(validateWaTemplateBody(key, entry.defaultBody)).toBeNull()
  })

  it('orders all keys', () => {
    expect(new Set(WA_TEMPLATE_KEYS_ORDERED)).toEqual(new Set(enumKeys))
  })

  it('allowedTokens merges required and optional', () => {
    const key = WaTemplateKey.approved
    const entry = getWaTemplateEntry(key)
    expect(allowedTokensForKey(key)).toEqual([...entry.requiredTokens, ...entry.optionalTokens])
  })
})
