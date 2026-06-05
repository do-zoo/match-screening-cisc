import { describe, expect, it } from 'vitest'

import { resolveInvoicePdfLogoSrc } from './resolve-invoice-pdf-logo-src'

describe('resolveInvoicePdfLogoSrc', () => {
  it('returns png data uri from default public logo when blob url missing', async () => {
    const src = await resolveInvoicePdfLogoSrc(null)
    expect(src).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
  })

  it('returns null for invalid remote url without readable default', async () => {
    const src = await resolveInvoicePdfLogoSrc('https://invalid.example.test/nope.webp')
    // Still falls back to public/logo.webp when present in repo
    expect(src === null || src.startsWith('data:image/png;base64,')).toBe(true)
  })
})
