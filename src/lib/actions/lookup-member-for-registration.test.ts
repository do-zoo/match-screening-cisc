import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/members/resolve-master-member-registration-lookup', () => ({
  resolveMasterMemberRegistrationLookup: vi.fn(),
}))

import { resolveMasterMemberRegistrationLookup } from '@/lib/members/resolve-master-member-registration-lookup'
import { lookupMemberForRegistration } from './lookup-member-for-registration'

describe('lookupMemberForRegistration', () => {
  beforeEach(() => {
    vi.mocked(resolveMasterMemberRegistrationLookup).mockReset()
  })

  it('returns masked whatsapp and email on valid lookup', async () => {
    vi.mocked(resolveMasterMemberRegistrationLookup).mockResolvedValue({
      status: 'valid',
      fullName: 'EDWAR',
      whatsapp: '+628119821309',
      email: 'edwardedo603@gmail.com',
    })

    const result = await lookupMemberForRegistration('CISC2623960027', 'event-1')
    expect(result).toEqual({
      status: 'valid',
      fullName: 'EDWAR',
      whatsapp: expect.stringMatching(/•/),
      email: expect.stringMatching(/•/),
    })
    if (result.status === 'valid') {
      expect(result.whatsapp).not.toContain('9821309')
      expect(result.email).not.toContain('edwardedo603')
      expect(result.email).toContain('@gmail.com')
    }
  })

  it('passes through not_found', async () => {
    vi.mocked(resolveMasterMemberRegistrationLookup).mockResolvedValue({ status: 'not_found' })
    expect(await lookupMemberForRegistration('x', 'event-1')).toEqual({ status: 'not_found' })
  })
})
