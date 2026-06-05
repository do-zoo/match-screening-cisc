import { describe, expect, it } from 'vitest'

import { resolveContactDisplayLabel } from './resolve-contact-display-label'

describe('resolveContactDisplayLabel', () => {
  it('prefers admin label', () => {
    expect(
      resolveContactDisplayLabel({
        label: 'IG Resmi',
        url: 'https://instagram.com/cisc',
        platform: 'instagram',
      }),
    ).toBe('IG Resmi')
  })

  it('uses registry default when label empty', () => {
    expect(
      resolveContactDisplayLabel({
        label: '',
        url: 'https://instagram.com/cisc',
        platform: 'instagram',
      }),
    ).toBe('Instagram')
  })

  it('uses hostname for unknown platform', () => {
    expect(
      resolveContactDisplayLabel({
        label: '',
        url: 'https://www.komunitas.example/path',
        platform: 'link',
      }),
    ).toBe('komunitas.example')
  })
})
