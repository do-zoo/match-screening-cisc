import { describe, expect, it } from 'vitest'

import { partitionVenueLinkedEvents } from '@/lib/venues/venue-delete-eligibility'

describe('partitionVenueLinkedEvents', () => {
  it('allows delete when only draft events without registrations', () => {
    const r = partitionVenueLinkedEvents([
      { id: 'e1', title: 'Draf A', status: 'draft', registrationCount: 0 },
    ])
    expect(r.canDeleteVenue).toBe(true)
    expect(r.blocking).toHaveLength(0)
    expect(r.draftsToRemove).toHaveLength(1)
  })

  it('blocks when an active event is linked', () => {
    const r = partitionVenueLinkedEvents([
      { id: 'e1', title: 'Aktif', status: 'active', registrationCount: 0 },
    ])
    expect(r.canDeleteVenue).toBe(false)
    expect(r.blocking).toHaveLength(1)
  })

  it('blocks when a draft has registrations', () => {
    const r = partitionVenueLinkedEvents([
      { id: 'e1', title: 'Draf isi', status: 'draft', registrationCount: 2 },
    ])
    expect(r.canDeleteVenue).toBe(false)
    expect(r.blocking).toHaveLength(1)
  })

  it('blocks active events even when deletable drafts also exist', () => {
    const r = partitionVenueLinkedEvents([
      { id: 'e1', title: 'Draf', status: 'draft', registrationCount: 0 },
      { id: 'e2', title: 'Aktif', status: 'active', registrationCount: 0 },
    ])
    expect(r.canDeleteVenue).toBe(false)
    expect(r.draftsToRemove).toHaveLength(1)
    expect(r.blocking).toHaveLength(1)
  })
})
