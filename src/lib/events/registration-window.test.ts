import { describe, expect, it } from 'vitest'

import { isRegistrationOpenForEvent, registrationBlockMessageForPublic } from './registration-window'

describe('registration-window', () => {
  const open = new Date('2020-01-01T00:00:00.000Z')
  const close = new Date('2030-01-01T00:00:00.000Z')

  const activeBase = {
    status: 'active' as const,
    registrationManualClosed: false,
    openRegistrationAt: open,
    closeRegistrationAt: close,
  }

  it('is open when active, not manual-closed, and window open', () => {
    expect(
      isRegistrationOpenForEvent({
        event: activeBase,
        now: new Date('2025-06-01T00:00:00.000Z'),
      }),
    ).toBe(true)
  })

  it('closes when manually closed', () => {
    expect(
      isRegistrationOpenForEvent({
        event: { ...activeBase, registrationManualClosed: true },
        now: new Date('2025-06-01T00:00:00.000Z'),
      }),
    ).toBe(false)
    expect(
      registrationBlockMessageForPublic({
        eventStatus: 'active',
        registrationManualClosed: true,
        openRegistrationAt: open,
        closeRegistrationAt: close,
        now: new Date('2025-06-01T00:00:00.000Z'),
      }),
    ).toMatch(/ditutup/i)
  })

  it('closes when before open window', () => {
    expect(
      isRegistrationOpenForEvent({
        event: activeBase,
        now: new Date('2010-01-01T00:00:00.000Z'),
      }),
    ).toBe(false)
    expect(
      registrationBlockMessageForPublic({
        eventStatus: 'active',
        registrationManualClosed: false,
        openRegistrationAt: open,
        closeRegistrationAt: close,
        now: new Date('2010-01-01T00:00:00.000Z'),
      }),
    ).toMatch(/belum dibuka/i)
  })
})
