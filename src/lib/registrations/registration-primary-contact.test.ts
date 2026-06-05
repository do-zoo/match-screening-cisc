import { describe, expect, it } from 'vitest'

import { getPrimaryHolder, resolveRegistrationContactDisplay } from './registration-primary-contact'

describe('getPrimaryHolder', () => {
  it('memilih sortOrder terkecil', () => {
    const holders = [
      { id: 'b', sortOrder: 2, holderName: 'B', holderWhatsapp: null, holderEmail: null },
      { id: 'a', sortOrder: 1, holderName: 'A', holderWhatsapp: '+62', holderEmail: 'a@x.com' },
    ]
    expect(getPrimaryHolder(holders)?.id).toBe('a')
  })
})

describe('resolveRegistrationContactDisplay', () => {
  it('mengutamakan field holder utama', () => {
    const view = resolveRegistrationContactDisplay({
      contactName: 'Legacy',
      contactWhatsapp: '000',
      contactEmail: 'old@x.com',
      holders: [
        {
          id: 'h1',
          sortOrder: 1,
          holderName: 'Pemesan',
          holderWhatsapp: '+62811',
          holderEmail: 'pemesan@x.com',
        },
      ],
    })
    expect(view.name).toBe('Pemesan')
    expect(view.whatsapp).toBe('+62811')
    expect(view.email).toBe('pemesan@x.com')
    expect(view.primaryHolderId).toBe('h1')
  })
})
