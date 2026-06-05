import { describe, expect, it } from 'vitest'

import { buildRegistrationEmailUrlVars } from '@/lib/email-templates/registration-email-url-vars'

describe('buildRegistrationEmailUrlVars', () => {
  it('builds public event and registration URLs', () => {
    expect(
      buildRegistrationEmailUrlVars({
        origin: 'https://klub.example/',
        eventSlug: 'gala-dinner',
        registrationId: 'reg-1',
      }),
    ).toEqual({
      event_page_url: 'https://klub.example/events/gala-dinner',
      registration_page_url: 'https://klub.example/events/gala-dinner/register/reg-1',
    })
  })

  it('returns empty when slug missing', () => {
    expect(buildRegistrationEmailUrlVars({ origin: 'https://klub.example', eventSlug: '' })).toEqual({})
  })
})
