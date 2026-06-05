import { describe, expect, it } from 'vitest'
import { render } from 'react-email'
import { createElement } from 'react'

import { ClubEmailContactFooter } from './club-email-contact-footer'

describe('ClubEmailContactFooter', () => {
  it('embeds absolute icon src for contact email', async () => {
    const html = await render(
      createElement(ClubEmailContactFooter, {
        clubNameNav: 'CISC',
        contactEmail: 'komite@example.com',
        websiteUrl: null,
        locationText: null,
        socialLinks: [],
        appOrigin: 'https://app.example',
      }),
    )
    expect(html).toContain('https://app.example/branding-icons/email.png')
    expect(html).toContain('komite@example.com')
  })
})
