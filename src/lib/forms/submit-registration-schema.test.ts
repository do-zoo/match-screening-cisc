import { describe, expect, it } from 'vitest'

import { holderSchema, submitRegistrationSchema } from './submit-registration-schema'

function transferProofFile() {
  return new File([new Uint8Array([1])], 'p.jpg', { type: 'image/jpeg' })
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ticketCategoryId: 'cat-1',
    ticketQty: 1,
    holders: [{ holderName: 'Budi Santoso', claimedMemberNumber: '', mandatoryMenuItemId: '' }],
    contactWhatsapp: '08123456789',
    transferProof: transferProofFile(),
    ...overrides,
  }
}

describe('holderSchema', () => {
  it('accepts a holder with only holderName', () => {
    const r = holderSchema.safeParse({ holderName: 'Budi' })
    expect(r.success).toBe(true)
  })

  it('rejects empty holderName', () => {
    const r = holderSchema.safeParse({ holderName: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path[0]).toBe('holderName')
    }
  })

  it('trims whitespace-only holderName', () => {
    const r = holderSchema.safeParse({ holderName: '   ' })
    expect(r.success).toBe(false)
  })

  it('accepts optional claimedMemberNumber', () => {
    const r = holderSchema.safeParse({ holderName: 'Budi', claimedMemberNumber: 'CISC-001' })
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

  it('accepts multiple holders', () => {
    const r = submitRegistrationSchema.safeParse(
      validPayload({
        ticketQty: 2,
        holders: [{ holderName: 'Budi', claimedMemberNumber: 'CISC-001' }, { holderName: 'Rina' }],
      }),
    )
    expect(r.success).toBe(true)
  })
})
