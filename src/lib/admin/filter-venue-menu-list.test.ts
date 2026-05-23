import { describe, expect, it } from 'vitest'

import { venueMenuRowMatchesLockFilter, venueMenuRowMatchesSearch } from '@/lib/admin/filter-venue-menu-list'

describe('venueMenuRowMatchesSearch', () => {
  it('matches name case-insensitively', () => {
    expect(venueMenuRowMatchesSearch({ name: 'Kopi Susu', description: null, price: 1000 }, 'kopi')).toBe(true)
  })

  it('matches description', () => {
    expect(venueMenuRowMatchesSearch({ name: 'X', description: 'Dingin', price: 0 }, 'dingin')).toBe(true)
  })

  it('matches empty query as true', () => {
    expect(venueMenuRowMatchesSearch({ name: 'A', description: null, price: 1 }, '')).toBe(true)
  })
})

describe('venueMenuRowMatchesLockFilter', () => {
  const frozen = new Set(['a'])

  it('all passes', () => {
    expect(venueMenuRowMatchesLockFilter({ id: 'a' }, 'all', frozen)).toBe(true)
  })

  it('locked only frozen ids', () => {
    expect(venueMenuRowMatchesLockFilter({ id: 'a' }, 'locked', frozen)).toBe(true)
    expect(venueMenuRowMatchesLockFilter({ id: 'b' }, 'locked', frozen)).toBe(false)
  })

  it('unlocked excludes frozen', () => {
    expect(venueMenuRowMatchesLockFilter({ id: 'b' }, 'unlocked', frozen)).toBe(true)
    expect(venueMenuRowMatchesLockFilter({ id: 'a' }, 'unlocked', frozen)).toBe(false)
  })
})
