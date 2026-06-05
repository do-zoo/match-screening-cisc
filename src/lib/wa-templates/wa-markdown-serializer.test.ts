import { WaTemplateKey } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { getWaTemplateEntry } from '@/lib/wa-templates/wa-template-catalog'
import { docToWaMarkdown, waMarkdownToDoc } from '@/lib/wa-templates/wa-markdown-serializer'

describe('wa-markdown-serializer', () => {
  const approved = getWaTemplateEntry(WaTemplateKey.approved)

  it('round-trips bold and placeholder', () => {
    const src = 'Halo *{event_title}* di {venue}'
    const doc = waMarkdownToDoc(src, approved)
    expect(docToWaMarkdown(doc)).toBe(src)
  })

  it('round-trips bullet list', () => {
    const src = '- baris satu\n- baris dua'
    expect(docToWaMarkdown(waMarkdownToDoc(src, approved))).toBe(src)
  })

  it('round-trips default approved body', () => {
    const src = approved.defaultBody
    expect(docToWaMarkdown(waMarkdownToDoc(src, approved))).toBe(src)
  })

  it('round-trips receipt body with inline code placeholder', () => {
    const receipt = getWaTemplateEntry(WaTemplateKey.receipt)
    const src = receipt.defaultBody
    expect(docToWaMarkdown(waMarkdownToDoc(src, receipt))).toBe(src)
  })
})
