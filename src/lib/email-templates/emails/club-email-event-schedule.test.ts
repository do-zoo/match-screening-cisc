import { EmailTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { render } from 'react-email'
import { createElement } from 'react'

import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { buildEventScheduleParts } from '@/lib/email-templates/emails/club-email-event-schedule'
import { renderEmailBlocks } from '@/lib/email-templates/emails/club-email-blocks'

describe('buildEventScheduleParts', () => {
  it('includes nama acara, venue, lokasi, and waktu (no buka gate)', () => {
    const parts = buildEventScheduleParts({
      event_title: 'Nobar Final',
      venue: 'Gelora Bung Karno',
      venue_address: 'Jl. Pintu Satu Senayan, Jakarta Pusat',
      start_at_formatted: '11 Juni 2026 pukul 00.47',
      open_gate_at_formatted: '11 Juni 2026 pukul 00.17',
    })

    expect(parts).not.toBeNull()
    expect(parts!.meta.map(r => r.label)).toEqual([
      'Nama acara',
      'Venue',
      'Lokasi acara',
      'Waktu acara',
    ])
    expect(parts!.meta.find(r => r.label === 'Nama acara')?.value).toBe('Nobar Final')
    expect(parts!.meta.find(r => r.label === 'Buka gate')).toBeUndefined()
    expect(parts!.meta.find(r => r.label === 'Lokasi acara')?.href).toBeUndefined()
  })

  it('links lokasi acara when venue_map_url is set', () => {
    const parts = buildEventScheduleParts({
      venue_address: 'Jl. Pintu Satu Senayan',
      venue_map_url: 'https://maps.google.com/?q=GBK',
    })

    expect(parts!.meta.find(r => r.label === 'Lokasi acara')).toMatchObject({
      value: 'Jl. Pintu Satu Senayan',
      href: 'https://maps.google.com/?q=GBK',
    })
  })
})

describe('renderEmailBlocks registration_approved', () => {
  it('renders schedule in default template; receipt card has no venue row', async () => {
    const entry = getEmailTemplateEntry(EmailTemplateKey.registration_approved)
    const vars = {
      contact_name: 'Budi',
      event_title: 'Nobar',
      registration_id: 'REG-1',
      computed_total_idr: 'Rp100.000',
      venue: 'Gelora Bung Karno',
      venue_address: 'Jl. Senayan',
      start_at_formatted: '11 Juni 2026 pukul 00.47',
    }

    const receiptOnly = renderEmailBlocks({
      templateKey: EmailTemplateKey.registration_approved,
      blocks: [{ type: 'registration_receipt', id: 'receipt' }],
      vars,
    })
    const receiptHtml = await render(createElement('div', null, ...receiptOnly))
    expect(receiptHtml).toContain('Total terverifikasi')
    expect(receiptHtml).not.toContain('Nama acara')
    expect(receiptHtml).not.toContain('Gelora Bung Karno')
    expect(receiptHtml).not.toContain('Lokasi acara')

    const full = renderEmailBlocks({
      templateKey: EmailTemplateKey.registration_approved,
      blocks: entry.defaultBlocks,
      vars,
    })
    const fullHtml = await render(createElement('div', null, ...full))
    expect(fullHtml).toContain('Ringkasan acara')
    expect(fullHtml).toContain('Ringkasan pesanan')
    expect(fullHtml).toContain('Nama acara')
    expect(fullHtml).toContain('Nobar')
    expect(fullHtml).toContain('Gelora Bung Karno')
    expect(fullHtml).toContain('Waktu acara')
    expect(fullHtml).not.toContain('Buka gate')
  })
})
