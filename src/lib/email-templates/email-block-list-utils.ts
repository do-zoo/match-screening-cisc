import type { JSONContent } from '@tiptap/core'

import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { newBlockId } from '@/lib/email-templates/email-block-types'
import { emptyEmailDoc } from '@/lib/email-templates/email-doc-serializer'

export function moveEmailBlock(blocks: EmailBlock[], id: string, direction: -1 | 1): EmailBlock[] {
  const index = blocks.findIndex(b => b.id === id)
  if (index < 0) return blocks
  const target = index + direction
  if (target < 0 || target >= blocks.length) return blocks
  return reorderEmailBlocksByIndex(blocks, index, target)
}

/** Pindahkan blok `activeId` ke posisi sebelum `overId` (sisip di indeks target). */
export function reorderEmailBlocks(blocks: EmailBlock[], activeId: string, overId: string): EmailBlock[] {
  const from = blocks.findIndex(b => b.id === activeId)
  const to = blocks.findIndex(b => b.id === overId)
  if (from < 0 || to < 0 || from === to) return blocks
  return reorderEmailBlocksByIndex(blocks, from, to)
}

function reorderEmailBlocksByIndex(blocks: EmailBlock[], from: number, to: number): EmailBlock[] {
  const next = [...blocks]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

export function addParagraphBlock(blocks: EmailBlock[]): EmailBlock[] {
  const paragraph: EmailBlock = { type: 'paragraph', id: newBlockId(), doc: emptyEmailDoc() }
  const ctaIndex = blocks.findIndex(b => b.type === 'cta_button')
  if (ctaIndex >= 0) {
    return [...blocks.slice(0, ctaIndex), paragraph, ...blocks.slice(ctaIndex)]
  }
  return [...blocks, paragraph]
}

export function removeParagraphBlock(blocks: EmailBlock[], id: string): EmailBlock[] {
  const paragraphs = blocks.filter(b => b.type === 'paragraph')
  if (paragraphs.length <= 1) return blocks
  return blocks.filter(b => !(b.type === 'paragraph' && b.id === id))
}

export function updateParagraphDoc(blocks: EmailBlock[], id: string, doc: JSONContent): EmailBlock[] {
  return blocks.map(b => (b.type === 'paragraph' && b.id === id ? { ...b, doc } : b))
}

export function updateBlockField(
  blocks: EmailBlock[],
  id: string,
  patch: Partial<Pick<Extract<EmailBlock, { type: 'cta_button' }>, 'label'>> &
    Partial<Pick<Extract<EmailBlock, { type: 'footer_disclaimer' }>, 'text'>>,
): EmailBlock[] {
  return blocks.map(b => {
    if ('id' in b && b.id === id) {
      if (b.type === 'cta_button' && patch.label !== undefined) {
        return { ...b, label: patch.label }
      }
      if (b.type === 'footer_disclaimer' && patch.text !== undefined) {
        return { ...b, text: patch.text }
      }
    }
    return b
  })
}
