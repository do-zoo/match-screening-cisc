import { describe, expect, it } from 'vitest'

import {
  collectTokensFromDoc,
  emailDocToPlainText,
  plainTextToEmailDoc,
} from '@/lib/email-templates/email-doc-serializer'

describe('email-doc-serializer', () => {
  it('round-trips placeholder chip', () => {
    const doc = plainTextToEmailDoc('Halo {contact_name}')
    expect(collectTokensFromDoc(doc)).toContain('contact_name')
    expect(emailDocToPlainText(doc, { contact_name: 'Budi' })).toBe('Halo Budi')
  })

  it('handles multiline plain text', () => {
    const doc = plainTextToEmailDoc('Baris satu\nBaris dua')
    expect(emailDocToPlainText(doc, {})).toContain('Baris satu')
    expect(emailDocToPlainText(doc, {})).toContain('Baris dua')
  })
})
