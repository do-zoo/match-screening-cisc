import { describe, expect, it } from 'vitest'

import {
  buildTicketLineItems,
  parseTransactionLineItems,
  serializeTransactionLineItems,
} from '@/lib/email-templates/email-transaction-line-items'
import { formatWaIdr } from '@/lib/wa-templates/format-wa-idr'

describe('email-transaction-line-items', () => {
  it('builds one row per ticket with menu note', () => {
    const items = buildTicketLineItems([
      {
        sortOrder: 1,
        ticketPriceApplied: 500_000,
        assignedHolder: { holderName: 'Budi' },
        mandatoryMenuItem: { name: 'Paket A' },
      },
      {
        sortOrder: 2,
        ticketPriceApplied: 500_000,
        assignedHolder: { holderName: 'Ani' },
        mandatoryMenuItem: null,
      },
    ])
    expect(items).toHaveLength(2)
    expect(items[0]?.sortOrder).toBe(1)
    expect(items[0]?.holderName).toBe('Budi')
    expect(items[0]?.menuName).toBe('Paket A')
    expect(items[0]?.label).toBe('Tiket #1 · Budi')
    expect(items[0]?.value).toBe(formatWaIdr(500_000))
    expect(items[0]?.note).toBe('Menu: Paket A')
    expect(items[1]?.note).toBeUndefined()
  })

  it('round-trips JSON serialization', () => {
    const raw = serializeTransactionLineItems([
      { label: 'Tiket #1 · X', value: 'Rp10.000', note: 'Menu: Y' },
    ])
    expect(parseTransactionLineItems(raw)).toEqual([
      { label: 'Tiket #1 · X', value: 'Rp10.000', note: 'Menu: Y' },
    ])
  })
})
