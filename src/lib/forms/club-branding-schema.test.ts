import { describe, expect, it } from 'vitest'

import { clubBrandingTextsSchema, socialLinksForDb } from '@/lib/forms/club-branding-schema'

describe('clubBrandingTextsSchema', () => {
  it('accepts empty contact fields', () => {
    const r = clubBrandingTextsSchema.safeParse({
      clubNameNav: 'CISC',
      contactEmail: '',
      websiteUrl: '',
      locationText: '',
      socialLinks: [],
    })
    expect(r.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const r = clubBrandingTextsSchema.safeParse({
      clubNameNav: 'CISC',
      contactEmail: 'not-an-email',
      websiteUrl: '',
      locationText: '',
      socialLinks: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejects http website', () => {
    const r = clubBrandingTextsSchema.safeParse({
      clubNameNav: 'CISC',
      contactEmail: '',
      websiteUrl: 'http://example.com',
      locationText: '',
      socialLinks: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejects label without url', () => {
    const r = clubBrandingTextsSchema.safeParse({
      clubNameNav: 'CISC',
      contactEmail: '',
      websiteUrl: '',
      locationText: '',
      socialLinks: [{ label: 'IG', url: '' }],
    })
    expect(r.success).toBe(false)
  })

  it('accepts url without label', () => {
    const r = clubBrandingTextsSchema.safeParse({
      clubNameNav: 'CISC',
      contactEmail: '',
      websiteUrl: '',
      locationText: '',
      socialLinks: [{ label: '', url: 'https://instagram.com/cisc' }],
    })
    expect(r.success).toBe(true)
  })
})

describe('socialLinksForDb', () => {
  it('filters empty rows and keeps url-only rows', () => {
    expect(
      socialLinksForDb([
        { label: 'IG', url: 'https://ig.com' },
        { label: '', url: '' },
        { label: '', url: 'https://youtube.com/cisc' },
      ]),
    ).toEqual([
      { label: 'IG', url: 'https://ig.com' },
      { label: '', url: 'https://youtube.com/cisc' },
    ])
  })
})
