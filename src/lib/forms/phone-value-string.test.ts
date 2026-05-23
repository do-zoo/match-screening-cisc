import { describe, expect, it } from 'vitest'

import {
  EMPTY_PHONE_VALUE,
  phoneValueToStoredString,
  stringToPhoneValue,
  toE164PlusForValidation,
  whatsappDigitsOnly,
} from '@/lib/forms/phone-value-string'

describe('stringToPhoneValue', () => {
  it('returns empty ID value for blank input', () => {
    expect(stringToPhoneValue('')).toEqual(EMPTY_PHONE_VALUE)
    expect(stringToPhoneValue('  ')).toEqual(EMPTY_PHONE_VALUE)
  })

  it('parses Indonesian local 08… into national without leading 0', () => {
    const v = stringToPhoneValue('08123456789')
    expect(v.countryIso).toBe('ID')
    expect(v.nationalNumber.replace(/\D/g, '')).toMatch(/^8/)
    expect(phoneValueToStoredString(v)).toMatch(/^628/)
  })

  it('parses digits-only 62… as Indonesia', () => {
    const v = stringToPhoneValue('6281234567890')
    expect(v.countryIso).toBe('ID')
    expect(phoneValueToStoredString(v)).toBe('6281234567890')
  })

  it('roundtrip is stable for partial Indonesian numbers (delete bug fix)', () => {
    // parsePhoneNumberFromString("628...", "ID") used to return nationalNumber = "628..."
    // (including country code digits) for numbers shorter than 10 national digits,
    // causing the controlled input to snap back when the user tried to delete.
    for (let len = 1; len <= 9; len++) {
      const national = '8'.repeat(len)
      const stored = `62${national}`
      const v = stringToPhoneValue(stored)
      expect(v.nationalNumber).toBe(national)
    }
  })
})

describe('phoneValueToStoredString', () => {
  it('returns empty when national empty', () => {
    expect(phoneValueToStoredString(EMPTY_PHONE_VALUE)).toBe('')
  })

  it('concatenates country calling code and national digits', () => {
    expect(
      phoneValueToStoredString({
        countryCode: '+65',
        countryIso: 'SG',
        nationalNumber: '91234567',
      }),
    ).toBe('6591234567')
  })
})

describe('toE164PlusForValidation', () => {
  it('accepts legacy Indonesian input for validation prefix', () => {
    expect(toE164PlusForValidation('08123456789')).toBe('+628123456789')
  })

  it('returns null when too short', () => {
    expect(toE164PlusForValidation('0812')).toBeNull()
    expect(toE164PlusForValidation('')).toBeNull()
  })
})

describe('whatsappDigitsOnly', () => {
  it('strips non-digits', () => {
    expect(whatsappDigitsOnly('+62 812-345')).toBe('62812345')
  })
})
