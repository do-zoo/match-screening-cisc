import { describe, expect, it } from 'vitest'

import { detectContactPlatform, normalizeHostname } from './contact-platform'

describe('normalizeHostname', () => {
  it('strips www', () => {
    expect(normalizeHostname('WWW.Instagram.COM')).toBe('instagram.com')
  })
})

describe('detectContactPlatform', () => {
  it('detects instagram', () => {
    expect(detectContactPlatform('https://www.instagram.com/cisc')).toBe('instagram')
  })

  it('detects youtu.be', () => {
    expect(detectContactPlatform('https://youtu.be/abc')).toBe('youtube')
  })

  it('detects x.com and twitter.com', () => {
    expect(detectContactPlatform('https://x.com/cisc')).toBe('x')
    expect(detectContactPlatform('https://twitter.com/cisc')).toBe('x')
  })

  it('returns link for unknown host', () => {
    expect(detectContactPlatform('https://example.org/page')).toBe('link')
  })

  it('returns link for invalid url', () => {
    expect(detectContactPlatform('not-a-url')).toBe('link')
  })
})
