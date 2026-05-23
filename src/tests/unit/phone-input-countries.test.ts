import { describe, expect, test } from 'vitest'
import { COUNTRIES, isoToFlag } from '@/components/ui/phone-input-countries'

describe('phone-input-countries', () => {
  test('isoToFlag converts ISO to flag emoji', () => {
    expect(isoToFlag('ID')).toBe('🇮🇩')
    expect(isoToFlag('SG')).toBe('🇸🇬')
    expect(isoToFlag('US')).toBe('🇺🇸')
  })

  test('COUNTRIES contains Indonesia with correct data', () => {
    const id = COUNTRIES.find(c => c.iso === 'ID')
    expect(id).toBeDefined()
    expect(id!.dialCode).toBe('+62')
    expect(id!.flag).toBe('🇮🇩')
    expect(id!.name).toBeTruthy()
  })

  test('COUNTRIES has 200+ entries', () => {
    expect(COUNTRIES.length).toBeGreaterThan(200)
  })

  test('every entry has required fields', () => {
    for (const c of COUNTRIES) {
      expect(c.iso).toBeTruthy()
      expect(c.dialCode).toMatch(/^\+\d+$/)
      expect(c.flag).toBeTruthy()
      expect(c.name).toBeTruthy()
    }
  })

  test('COUNTRIES is sorted by name', () => {
    const names = COUNTRIES.map(c => c.name)
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'id'))
    expect(names).toEqual(sorted)
  })
})
