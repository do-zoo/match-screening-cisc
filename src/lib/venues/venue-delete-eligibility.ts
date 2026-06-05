import type { EventStatus } from '@prisma/client'

export type VenueLinkedEventSummary = {
  id: string
  title: string
  status: EventStatus
  registrationCount: number
}

export function partitionVenueLinkedEvents(events: VenueLinkedEventSummary[]) {
  const blocking = events.filter(
    e => e.status === 'active' || e.status === 'finished' || e.registrationCount > 0,
  )
  const draftsToRemove = events.filter(e => e.status === 'draft' && e.registrationCount === 0)
  return {
    blocking,
    draftsToRemove,
    canDeleteVenue: blocking.length === 0,
  }
}
