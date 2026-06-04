import { describe, expect, it } from 'vitest'

import {
  MEMBER_ACCESS_MODE_BADGE,
  assertHolderEligibleForMemberAccessMode,
  isMemberOnlyAccessMode,
} from './member-access-mode'

describe('assertHolderEligibleForMemberAccessMode', () => {
  it('open — always ok', () => {
    expect(assertHolderEligibleForMemberAccessMode({ memberType: undefined }, 'open').ok).toBe(true)
  })

  it('cisc_members — rejects non-member', () => {
    const r = assertHolderEligibleForMemberAccessMode({ memberType: undefined }, 'cisc_members')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('khusus member CISC')
  })

  it('cisc_members — accepts regional', () => {
    expect(assertHolderEligibleForMemberAccessMode({ memberType: 'regional' }, 'cisc_members').ok).toBe(true)
  })

  it('tangsel_only — rejects regional', () => {
    expect(
      assertHolderEligibleForMemberAccessMode({ memberType: 'regional', claimedMemberNumber: 'R1' }, 'tangsel_only', true)
        .ok,
    ).toBe(false)
  })

  it('tangsel_only — accepts tangsel with valid lookup', () => {
    expect(
      assertHolderEligibleForMemberAccessMode({ memberType: 'tangsel', claimedMemberNumber: '123' }, 'tangsel_only', true)
        .ok,
    ).toBe(true)
  })

  it('tangsel_only — rejects tangsel without valid lookup', () => {
    expect(
      assertHolderEligibleForMemberAccessMode({ memberType: 'tangsel', claimedMemberNumber: '123' }, 'tangsel_only', false)
        .ok,
    ).toBe(false)
  })
})

describe('badges', () => {
  it('open has no badge', () => {
    expect(MEMBER_ACCESS_MODE_BADGE.open).toBeNull()
  })

  it('isMemberOnlyAccessMode', () => {
    expect(isMemberOnlyAccessMode('open')).toBe(false)
    expect(isMemberOnlyAccessMode('tangsel_only')).toBe(true)
  })
})
