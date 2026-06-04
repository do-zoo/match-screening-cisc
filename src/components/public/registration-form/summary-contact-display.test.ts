import { describe, expect, it } from 'vitest'

import { buildDisplayHolders, resolveHolderContactDisplay } from './summary-contact-display'

describe('resolveHolderContactDisplay', () => {
  it('uses masked directory contact for verified Tangsel when form fields are empty', () => {
    const result = resolveHolderContactDisplay(
      {
        holderName: 'Edwar',
        holderWhatsapp: '',
        claimedMemberNumber: 'T001',
        memberType: 'tangsel',
      },
      {
        status: 'valid',
        fullName: 'Edwar',
        whatsapp: '6281••••••89',
        email: 'ed••••@example.com',
      },
    )

    expect(result.memberNumber).toBe('T001')
    expect(result.whatsapp).toBe('6281••••••89')
    expect(result.email).toBe('ed••••@example.com')
  })

  it('prefers form overrides over directory lookup', () => {
    const result = resolveHolderContactDisplay(
      {
        holderName: 'Edwar',
        holderWhatsapp: '628123456789',
        holderEmail: 'edwar@example.com',
        claimedMemberNumber: 'T001',
        memberType: 'tangsel',
      },
      {
        status: 'valid',
        fullName: 'Edwar',
        whatsapp: '6281••••••89',
        email: 'ed••••@example.com',
      },
    )

    expect(result.whatsapp).toMatch(/^6281/)
    expect(result.email).toContain('@example.com')
  })
})

describe('buildDisplayHolders', () => {
  it('clones primary holder for each ticket when requireAllHolderData is false', () => {
    const primary = {
      holderName: 'Edwar',
      holderWhatsapp: '',
      claimedMemberNumber: 'T001',
      memberType: 'tangsel' as const,
    }

    expect(buildDisplayHolders([primary], 3, false)).toHaveLength(3)
    expect(buildDisplayHolders([primary], 3, false)[2]?.holderName).toBe('Edwar')
  })
})
