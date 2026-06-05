import { EmailTemplateKey } from '@prisma/client'

import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { newBlockId } from '@/lib/email-templates/email-block-types'
import { plainTextToEmailDoc } from '@/lib/email-templates/email-doc-serializer'
import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'

const BANK_LINE_RE = /^(Bank|No\.\s*Rekening|Atas nama):/i

function isBankSectionChunk(chunk: string): boolean {
  return chunk.split('\n').some(line => BANK_LINE_RE.test(line.trim()))
}

function stripMagicLinkUrlLines(chunks: string[]): string[] {
  return chunks.filter(
    chunk => !chunk.includes('{magic_link_url}') && !/^https?:\/\//i.test(chunk.trim()),
  )
}

function cloneDefaultBlocks(key: EmailTemplateKey): EmailBlock[] {
  return getEmailTemplateEntry(key).defaultBlocks.map(block => {
    if (block.type === 'paragraph') {
      return { ...block, id: newBlockId(), doc: structuredClone(block.doc) }
    }
    if (block.type === 'cta_button' || block.type === 'footer_disclaimer') {
      return { ...block, id: newBlockId() }
    }
    return { ...block, id: newBlockId() }
  })
}

export function migratePlainBodyToBlocks(key: EmailTemplateKey, legacyBody: string): EmailBlock[] {
  const blocks = cloneDefaultBlocks(key)
  let chunks = legacyBody
    .split(/\n\n+/)
    .map(s => s.trim())
    .filter(Boolean)

  if (key === EmailTemplateKey.magic_link) {
    chunks = stripMagicLinkUrlLines(chunks)
  } else {
    chunks = chunks.filter(chunk => !isBankSectionChunk(chunk))
  }

  const paragraphSlots = blocks.filter((b): b is Extract<EmailBlock, { type: 'paragraph' }> => b.type === 'paragraph')
  for (let i = 0; i < paragraphSlots.length; i++) {
    const text = chunks[i]
    if (text) {
      paragraphSlots[i]!.doc = plainTextToEmailDoc(text)
    }
  }

  if (key === EmailTemplateKey.magic_link) {
    const footer = blocks.find((b): b is Extract<EmailBlock, { type: 'footer_disclaimer' }> => b.type === 'footer_disclaimer')
    const last = chunks[chunks.length - 1]
    if (footer && last && last.toLowerCase().includes('abaikan')) {
      footer.text = last
    }
  }

  return blocks
}
