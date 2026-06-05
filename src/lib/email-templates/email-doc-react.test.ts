import { describe, expect, it } from 'vitest'
import { render } from 'react-email'
import { createElement } from 'react'

import { emailDocToReactNodes } from '@/lib/email-templates/email-doc-react'

describe('emailDocToReactNodes blockquote', () => {
  it('renders kutipan as accent panel (not plain italic border)', async () => {
    const nodes = emailDocToReactNodes(
      {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Catatan penting' }] }],
          },
        ],
      },
      {},
    )
    const html = await render(createElement('div', null, ...nodes))
    expect(html).toContain('Catatan penting')
    expect(html).toContain('#eff6ff')
    expect(html).toContain('#1e3a8a')
  })

  it('renders paragraph text-align center in html', async () => {
    const nodes = emailDocToReactNodes(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: 'center' },
            content: [{ type: 'text', text: 'Teks tengah' }],
          },
        ],
      },
      {},
    )
    const html = await render(createElement('div', null, ...nodes))
    expect(html).toContain('Teks tengah')
    expect(html).toMatch(/text-align:\s*center/i)
  })
})
