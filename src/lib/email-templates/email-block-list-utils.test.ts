import { describe, expect, it } from 'vitest'

import { emptyEmailDoc } from '@/lib/email-templates/email-doc-serializer'
import { moveEmailBlock, reorderEmailBlocks } from '@/lib/email-templates/email-block-list-utils'

describe('email-block-list-utils', () => {
  const blocks = [
    { type: 'branding_header' as const, id: 'a' },
    { type: 'paragraph' as const, id: 'b', doc: emptyEmailDoc() },
    { type: 'bank_details' as const, id: 'c' },
  ]

  it('moveEmailBlock swaps adjacent items', () => {
    const next = moveEmailBlock(blocks, 'b', 1)
    expect(next.map(b => b.id)).toEqual(['a', 'c', 'b'])
  })

  it('reorderEmailBlocks moves block to target index', () => {
    const next = reorderEmailBlocks(blocks, 'c', 'a')
    expect(next.map(b => b.id)).toEqual(['c', 'a', 'b'])
  })

  it('reorderEmailBlock is no-op for unknown id', () => {
    const next = reorderEmailBlocks(blocks, 'missing', 'a')
    expect(next).toBe(blocks)
  })
})
