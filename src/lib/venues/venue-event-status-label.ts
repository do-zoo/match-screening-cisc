import type { EventStatus } from '@prisma/client'

export const VENUE_LINKED_EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draf',
  active: 'Aktif',
  finished: 'Selesai',
}
