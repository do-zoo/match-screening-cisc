import { describe, expect, it } from 'vitest'

import { hasAnyClubContact, parseClubSocialLinks } from '@/lib/branding/club-social-links'

describe('parseClubSocialLinks', () => {
  it('returns empty for null', () => {
    expect(parseClubSocialLinks(null)).toEqual([])
  })

  it('parses valid links', () => {
    expect(
      parseClubSocialLinks([{ label: 'Instagram', url: 'https://instagram.com/cisc' }]),
    ).toEqual([{ label: 'Instagram', url: 'https://instagram.com/cisc' }])
  })

  it('rejects more than 3 links', () => {
    const raw = [
      { label: 'A', url: 'https://a.com' },
      { label: 'B', url: 'https://b.com' },
      { label: 'C', url: 'https://c.com' },
      { label: 'D', url: 'https://d.com' },
    ]
    expect(parseClubSocialLinks(raw)).toEqual([])
  })

  it('rejects http urls', () => {
    expect(parseClubSocialLinks([{ label: 'X', url: 'http://x.com' }])).toEqual([])
  })
})

describe('hasAnyClubContact', () => {
  it('false when all empty', () => {
    expect(
      hasAnyClubContact({
        contactEmail: null,
        websiteUrl: null,
        locationText: null,
        socialLinks: [],
      }),
    ).toBe(false)
  })

  it('true when email set', () => {
    expect(
      hasAnyClubContact({
        contactEmail: 'a@b.com',
        websiteUrl: null,
        locationText: null,
        socialLinks: [],
      }),
    ).toBe(true)
  })
})
