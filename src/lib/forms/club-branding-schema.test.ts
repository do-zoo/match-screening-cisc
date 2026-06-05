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

  it('rejects unpaired social row', () => {
    const r = clubBrandingTextsSchema.safeParse({
      clubNameNav: 'CISC',
      contactEmail: '',
      websiteUrl: '',
      locationText: '',
      socialLinks: [{ label: 'IG', url: '' }],
    })
    expect(r.success).toBe(false)
  })
})

describe('socialLinksForDb', () => {
  it('filters empty rows', () => {
    expect(
      socialLinksForDb([
        { label: 'IG', url: 'https://ig.com' },
        { label: '', url: '' },
      ]),
    ).toEqual([{ label: 'IG', url: 'https://ig.com' }])
  })
})
