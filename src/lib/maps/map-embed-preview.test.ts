import { describe, expect, it } from 'vitest'

import { buildGoogleMapsEmbedSrc, resolveMapEmbedSearchQuery } from '@/lib/maps/map-embed-preview'

describe('resolveMapEmbedSearchQuery', () => {
  it('prefers place name and address over mapUrl', () => {
    expect(
      resolveMapEmbedSearchQuery({
        placeName: 'Cafe A',
        placeAddress: 'Jakarta',
        mapUrl: 'https://example.com/maps',
      }),
    ).toEqual({ query: 'Cafe A, Jakarta', source: 'place' })
  })

  it('falls back to mapUrl when place is empty', () => {
    expect(
      resolveMapEmbedSearchQuery({
        placeName: '',
        placeAddress: '',
        mapUrl: 'https://maps.google.com/?q=test',
      }),
    ).toEqual({ query: 'https://maps.google.com/?q=test', source: 'url' })
  })
})

describe('buildGoogleMapsEmbedSrc', () => {
  it('returns null for empty query', () => {
    expect(buildGoogleMapsEmbedSrc('  ')).toBeNull()
  })

  it('returns embed URL for non-empty query', () => {
    const s = buildGoogleMapsEmbedSrc('Bandung')
    expect(s).toContain('maps.google.com')
    expect(s).toContain(encodeURIComponent('Bandung'))
    expect(s).toContain('output=embed')
  })
})
