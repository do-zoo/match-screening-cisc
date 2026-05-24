import { describe, expect, it } from 'vitest'

import { holderSchema, submitRegistrationSchema } from './submit-registration-schema'

describe('holderSchema.memberType', () => {
  const field = holderSchema.shape.memberType

  it('accepts tangsel', () => {
    expect(field.safeParse('tangsel').success).toBe(true)
  })

  it('accepts regional', () => {
    expect(field.safeParse('regional').success).toBe(true)
  })

  it('accepts undefined (non-member)', () => {
    expect(field.safeParse(undefined).success).toBe(true)
  })

  it('rejects any other string', () => {
    expect(field.safeParse('cisc').success).toBe(false)
    expect(field.safeParse('member').success).toBe(false)
    expect(field.safeParse('').success).toBe(false)
  })
})

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ticketCategoryId: 'cat-1',
    ticketQty: 1,
    holders: [
      { holderName: 'Budi Santoso', holderWhatsapp: '08123456789', claimedMemberNumber: '', mandatoryMenuItemId: '' },
    ],
    contactWhatsapp: '08123456789',
    ...overrides,
  }
}

describe('holderSchema', () => {
  it('accepts a holder with valid name and WA', () => {
    const r = holderSchema.safeParse({ holderName: 'Budi', holderWhatsapp: '08123456789' })
    expect(r.success).toBe(true)
  })

  it('rejects holder missing holderWhatsapp', () => {
    const r = holderSchema.safeParse({ holderName: 'Budi' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'holderWhatsapp')).toBe(true)
    }
  })

  it('rejects holder with invalid holderWhatsapp', () => {
    const r = holderSchema.safeParse({ holderName: 'Budi', holderWhatsapp: '123' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'holderWhatsapp')).toBe(true)
    }
  })

  it('rejects empty holderName', () => {
    const r = holderSchema.safeParse({ holderName: '', holderWhatsapp: '08123456789' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path[0]).toBe('holderName')
    }
  })

  it('trims whitespace-only holderName', () => {
    const r = holderSchema.safeParse({ holderName: '   ', holderWhatsapp: '08123456789' })
    expect(r.success).toBe(false)
  })

  it('accepts optional claimedMemberNumber for non-member', () => {
    const r = holderSchema.safeParse({
      holderName: 'Budi',
      holderWhatsapp: '08123456789',
      claimedMemberNumber: 'CISC-001',
    })
    expect(r.success).toBe(true)
  })

  it('requires claimedMemberNumber when memberType is regional', () => {
    const r = holderSchema.safeParse({ holderName: 'Budi', holderWhatsapp: '08123456789', memberType: 'regional' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'claimedMemberNumber')).toBe(true)
    }
  })

  it('accepts regional memberType with claimedMemberNumber filled', () => {
    const r = holderSchema.safeParse({
      holderName: 'Budi',
      holderWhatsapp: '08123456789',
      memberType: 'regional',
      claimedMemberNumber: 'REG-001',
    })
    expect(r.success).toBe(true)
  })
})

describe('submitRegistrationSchema', () => {
  it('accepts a valid payload with 1 holder', () => {
    const r = submitRegistrationSchema.safeParse(validPayload())
    expect(r.success).toBe(true)
  })

  it('rejects missing ticketCategoryId', () => {
    const r = submitRegistrationSchema.safeParse(validPayload({ ticketCategoryId: '' }))
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'ticketCategoryId')).toBe(true)
    }
  })

  it('rejects ticketQty < 1', () => {
    const r = submitRegistrationSchema.safeParse(validPayload({ ticketQty: 0 }))
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'ticketQty')).toBe(true)
    }
  })

  it('rejects empty holders array', () => {
    const r = submitRegistrationSchema.safeParse(validPayload({ holders: [] }))
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'holders')).toBe(true)
    }
  })

  it('accepts multiple holders each with valid WA', () => {
    const r = submitRegistrationSchema.safeParse(
      validPayload({
        ticketQty: 2,
        holders: [
          { holderName: 'Budi', holderWhatsapp: '08123456789', claimedMemberNumber: 'CISC-001' },
          { holderName: 'Rina', holderWhatsapp: '08198765432' },
        ],
      }),
    )
    expect(r.success).toBe(true)
  })

  it('rejects secondary holder missing holderWhatsapp', () => {
    const r = submitRegistrationSchema.safeParse(
      validPayload({
        ticketQty: 2,
        holders: [{ holderName: 'Budi', holderWhatsapp: '08123456789' }, { holderName: 'Rina' }],
      }),
    )
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'holders' && i.path[2] === 'holderWhatsapp')).toBe(true)
    }
  })

  it('rejects secondary holder with invalid holderWhatsapp', () => {
    const r = submitRegistrationSchema.safeParse(
      validPayload({
        ticketQty: 2,
        holders: [
          { holderName: 'Budi', holderWhatsapp: '08123456789' },
          { holderName: 'Rina', holderWhatsapp: '123' },
        ],
      }),
    )
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some(i => i.path[0] === 'holders' && i.path[2] === 'holderWhatsapp')).toBe(true)
    }
  })
})
