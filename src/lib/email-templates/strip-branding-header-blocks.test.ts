import { describe, expect, it } from 'vitest'

import { stripBrandingHeaderBlocks } from '@/lib/email-templates/strip-branding-header-blocks'

describe('stripBrandingHeaderBlocks', () => {
  it('removes branding_header blocks', () => {
    const blocks = stripBrandingHeaderBlocks([
      { type: 'branding_header', id: 'h' },
      { type: 'paragraph', id: 'p', doc: { type: 'doc', content: [] } },
    ])
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.type).toBe('paragraph')
  })
})
