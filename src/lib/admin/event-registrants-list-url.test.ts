import { describe, expect, it } from 'vitest'

import {
  buildEventRegistrantsListUrl,
  eventRegistrantsListPreservedQuery,
  parseEventRegistrantsTab,
  registrationListWhere,
} from '@/lib/admin/event-registrants-list-url'

describe('event-registrants-list-url', () => {
  const eventId = 'evt_1'

  it('parseEventRegistrantsTab defaults unknown to pending_review', () => {
    expect(parseEventRegistrantsTab(undefined)).toBe('pending_review')
    expect(parseEventRegistrantsTab('bogus')).toBe('pending_review')
  })

  it('parseEventRegistrantsTab accepts known tabs', () => {
    expect(parseEventRegistrantsTab('pending_review')).toBe('pending_review')
    expect(parseEventRegistrantsTab('closed')).toBe('closed')
  })

  it('buildEventRegistrantsListUrl omits default pending_review tab and cards view', () => {
    expect(
      buildEventRegistrantsListUrl(eventId, {
        tab: 'pending_review',
        view: 'cards',
        q: undefined,
      }),
    ).toBe(`/admin/events/${eventId}/registrants`)
  })

  it('buildEventRegistrantsListUrl keeps non-default tab=all in query string', () => {
    const url = buildEventRegistrantsListUrl(eventId, {
      tab: 'all',
      view: 'cards',
      q: undefined,
    })
    expect(url).toContain('tab=all')
  })

  it('buildEventRegistrantsListUrl encodes tab, view, q, page', () => {
    const url = buildEventRegistrantsListUrl(eventId, {
      tab: 'pending_review',
      view: 'table',
      q: 'foo',
      page: 2,
    })
    expect(url).not.toContain('tab=')
    expect(url).toContain('view=tabel')
    expect(url).toContain('q=foo')
    expect(url).toContain('page=2')
  })

  it('registrationListWhere maps closed to cancelled and refunded', () => {
    const w = registrationListWhere(eventId, 'closed', '')
    expect(w).toEqual({
      AND: [{ eventId }, { status: { in: ['cancelled', 'refunded'] } }],
    })
  })

  it('eventRegistrantsListPreservedQuery omits default pending_review tab', () => {
    expect(
      eventRegistrantsListPreservedQuery({
        tab: 'pending_review',
        view: 'cards',
        q: '',
      }),
    ).toEqual({})
  })
})
