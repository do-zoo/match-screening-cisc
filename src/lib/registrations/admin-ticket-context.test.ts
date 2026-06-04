import { describe, expect, it } from 'vitest'

import { aggregateCrossRegistrationConflicts } from './admin-ticket-context'

describe('aggregateCrossRegistrationConflicts', () => {
  it('returns empty for empty input', () => {
    expect(aggregateCrossRegistrationConflicts([])).toEqual([])
  })

  it('dedupes by registrationId and merges member numbers', () => {
    const out = aggregateCrossRegistrationConflicts([
      { registrationId: 'r1', contactName: 'Az', memberNumber: '100' },
      { registrationId: 'r1', contactName: 'Az', memberNumber: '100' },
      { registrationId: 'r1', contactName: 'Az', memberNumber: '200' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      registrationId: 'r1',
      contactName: 'Az',
      memberNumbers: ['100', '200'],
    })
  })

  it('sorts memberNumbers and sorts rows by contactName (id locale)', () => {
    const out = aggregateCrossRegistrationConflicts([
      { registrationId: 'b', contactName: 'Budi', memberNumber: '2' },
      { registrationId: 'a', contactName: 'Andi', memberNumber: '1' },
    ])
    expect(out.map(x => x.registrationId)).toEqual(['a', 'b'])
  })
})
