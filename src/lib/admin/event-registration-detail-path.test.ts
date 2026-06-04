import { describe, expect, it } from 'vitest'

import { pathsMatchRegistrationDetail } from '@/lib/admin/event-registration-detail-path'

describe('pathsMatchRegistrationDetail', () => {
  const eventId = 'evt_123'

  it('returns false for exact registrants list path', () => {
    expect(pathsMatchRegistrationDetail(`/admin/events/${eventId}/registrants`, eventId)).toBe(false)
  })

  it('returns true for registration detail under registrants', () => {
    expect(pathsMatchRegistrationDetail(`/admin/events/${eventId}/registrants/reg_abc`, eventId)).toBe(true)
  })

  it('returns false for unrelated path', () => {
    expect(pathsMatchRegistrationDetail(`/admin/events/${eventId}/report`, eventId)).toBe(false)
  })
})
