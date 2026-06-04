import { describe, expect, it } from 'vitest'

import { contactInitials, maskDisplayEmail, maskDisplayName, maskDisplayWhatsapp } from './mask-contact-display'

describe('maskDisplayName', () => {
  it('masks longer names preserving a short prefix', () => {
    expect(maskDisplayName('Budi Santoso')).toMatch(/^Bu•+$/)
    expect(maskDisplayName('Yi')).toBe('Y•')
    expect(maskDisplayName('')).toBe('•••')
    expect(maskDisplayName('AB')).toBe('A•')
  })
})

describe('maskDisplayWhatsapp', () => {
  it('masks phone-like strings preserving partial ends', () => {
    expect(maskDisplayWhatsapp('08123456789')).toMatch(/^0812•+/)
    expect(maskDisplayWhatsapp('08123456789')).toMatch(/89$/)
    expect(maskDisplayWhatsapp('+6281380013800')).toContain('•')
    expect(maskDisplayWhatsapp('+6281380013800')).toMatch(/^6281•+/)
    expect(maskDisplayWhatsapp('')).toBe('•••')
  })
})

describe('maskDisplayEmail', () => {
  it('masks local part while keeping domain visible', () => {
    expect(maskDisplayEmail('edwardedo603@gmail.com')).toBe('ed••••••••••@gmail.com')
    expect(maskDisplayEmail('')).toBe('—')
    expect(maskDisplayEmail('ab')).toBe('a•')
  })
})

describe('contactInitials', () => {
  it('extracts initials', () => {
    expect(contactInitials('Dimas Purnomo')).toBe('DP')
    expect(contactInitials('X')).toBe('X')
    expect(contactInitials('')).toBe('?')
  })
})
