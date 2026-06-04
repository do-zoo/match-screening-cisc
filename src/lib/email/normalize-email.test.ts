import { describe, expect, it } from 'vitest'

import { normalizeStoredEmail, optionalStoredEmail } from './normalize-email'

describe('normalizeStoredEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeStoredEmail('  Foo@Bar.COM ')).toBe('foo@bar.com')
  })

  it('rejects invalid', () => {
    expect(() => normalizeStoredEmail('not-an-email')).toThrow()
  })
})

describe('optionalStoredEmail', () => {
  it('returns null for empty', () => {
    expect(optionalStoredEmail('')).toBeNull()
    expect(optionalStoredEmail(null)).toBeNull()
  })
})
