import { describe, expect, it } from 'vitest'
import { getAdminInitials } from './admin-initials'

describe('getAdminInitials', () => {
  it('returns first letter of single name', () => {
    expect(getAdminInitials('Budi', null)).toBe('B')
  })

  it('returns first+last initials for multi-word name', () => {
    expect(getAdminInitials('Budi Santoso', null)).toBe('BS')
  })

  it('uses first and last word for three-word name', () => {
    expect(getAdminInitials('Budi Eko Santoso', null)).toBe('BS')
  })

  it('falls back to email first char when no name', () => {
    expect(getAdminInitials(null, 'budi@cisc.id')).toBe('B')
    expect(getAdminInitials('', 'budi@cisc.id')).toBe('B')
  })

  it('returns A when both are absent', () => {
    expect(getAdminInitials(null, null)).toBe('A')
  })

  it('is uppercase', () => {
    expect(getAdminInitials('budi santoso', null)).toBe('BS')
  })
})
