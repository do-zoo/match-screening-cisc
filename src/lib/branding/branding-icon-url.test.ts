import { describe, expect, it } from 'vitest'

import { brandingIconAbsoluteUrl, brandingIconPublicPath } from './branding-icon-url'

describe('brandingIconPublicPath', () => {
  it('returns path under branding-icons', () => {
    expect(brandingIconPublicPath('instagram')).toBe('/branding-icons/instagram.png')
  })
})

describe('brandingIconAbsoluteUrl', () => {
  it('builds absolute url', () => {
    expect(brandingIconAbsoluteUrl('email', 'https://app.example/')).toBe(
      'https://app.example/branding-icons/email.png',
    )
  })

  it('returns null without origin', () => {
    expect(brandingIconAbsoluteUrl('email', '')).toBeNull()
  })
})
