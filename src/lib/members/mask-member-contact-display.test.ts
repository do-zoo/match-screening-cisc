import { describe, expect, it } from 'vitest'

import { maskDisplayEmail, maskDisplayWhatsapp } from './mask-member-contact-display'

describe('maskDisplayWhatsapp', () => {
  it('masks phone-like strings preserving partial ends', () => {
    expect(maskDisplayWhatsapp('08123456789')).toMatch(/^0812•+/)
    expect(maskDisplayWhatsapp('08123456789')).toMatch(/89$/)
    expect(maskDisplayWhatsapp('+628119821309')).toContain('•')
    expect(maskDisplayWhatsapp('')).toBe('•••')
  })

  it('does not contain full middle digits for typical Indo numbers', () => {
    const masked = maskDisplayWhatsapp('+628119821309')
    expect(masked).not.toContain('9821309')
  })
})

describe('maskDisplayEmail', () => {
  it('masks local part while keeping domain visible', () => {
    expect(maskDisplayEmail('edwardedo603@gmail.com')).toBe('ed••••••••••@gmail.com')
    expect(maskDisplayEmail('edwardedo603@gmail.com')).not.toContain('edwardedo603')
    expect(maskDisplayEmail('')).toBe('—')
  })
})
