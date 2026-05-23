import { describe, expect, it } from 'vitest'
import { computeBadgeStatus } from './public-active-events'

const base = {
  registrationManualClosed: false,
  openRegistrationAt: new Date('2026-06-01T00:00:00Z'),
  closeRegistrationAt: new Date('2026-06-05T00:00:00Z'),
  registrationCapacity: 50,
  registrationsTowardQuota: 10,
}

describe('computeBadgeStatus', () => {
  it("returns 'closed' when registrationManualClosed is true", () => {
    expect(
      computeBadgeStatus({
        ...base,
        registrationManualClosed: true,
        now: new Date('2026-06-03T00:00:00Z'),
      }),
    ).toBe('closed')
  })

  it("returns 'closed' when now is before openRegistrationAt", () => {
    expect(computeBadgeStatus({ ...base, now: new Date('2026-05-31T23:59:59Z') })).toBe('closed')
  })

  it("returns 'closed' when now is at or after closeRegistrationAt", () => {
    expect(computeBadgeStatus({ ...base, now: new Date('2026-06-05T00:00:00Z') })).toBe('closed')
    expect(computeBadgeStatus({ ...base, now: new Date('2026-06-06T00:00:00Z') })).toBe('closed')
  })

  it("returns 'full' when registrationsTowardQuota >= registrationCapacity", () => {
    expect(
      computeBadgeStatus({
        ...base,
        registrationsTowardQuota: 50,
        now: new Date('2026-06-03T00:00:00Z'),
      }),
    ).toBe('full')
  })

  it("returns 'full' takes priority over 'closing_soon'", () => {
    expect(
      computeBadgeStatus({
        ...base,
        registrationsTowardQuota: 50,
        now: new Date('2026-06-04T20:00:00Z'),
      }),
    ).toBe('full')
  })

  it("does NOT return 'full' when registrationCapacity is null", () => {
    expect(
      computeBadgeStatus({
        ...base,
        registrationCapacity: null,
        registrationsTowardQuota: 999,
        now: new Date('2026-06-03T00:00:00Z'),
      }),
    ).toBe('open')
  })

  it("does NOT return 'full' when registrationCapacity is 0 or negative", () => {
    expect(
      computeBadgeStatus({
        ...base,
        registrationCapacity: 0,
        registrationsTowardQuota: 999,
        now: new Date('2026-06-03T00:00:00Z'),
      }),
    ).toBe('open')
  })

  it("returns 'closing_soon' when within 12 hours of closeRegistrationAt", () => {
    expect(computeBadgeStatus({ ...base, now: new Date('2026-06-04T12:00:00Z') })).toBe('closing_soon')
    expect(computeBadgeStatus({ ...base, now: new Date('2026-06-04T23:59:59Z') })).toBe('closing_soon')
  })

  it("returns 'open' outside the closing_soon window", () => {
    expect(computeBadgeStatus({ ...base, now: new Date('2026-06-04T11:59:59Z') })).toBe('open')
  })
})
