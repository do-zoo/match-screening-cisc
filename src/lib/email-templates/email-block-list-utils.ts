import type { JSONContent } from '@tiptap/core'

import type { EmailBlock } from '@/lib/email-templates/email-block-types'

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

export function removeEmailBlock(blocks: EmailBlock[], id: string): EmailBlock[] {
  return blocks.filter(b => b.id !== id)
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
  patch: Partial<Pick<Extract<EmailBlock, { type: 'cta_button' }>, 'label' | 'href'>> &
    Partial<Pick<Extract<EmailBlock, { type: 'footer_disclaimer' }>, 'text'>>,
): EmailBlock[] {
  return blocks.map(b => {
    if ('id' in b && b.id === id) {
      if (b.type === 'cta_button') {
        if (patch.label !== undefined || patch.href !== undefined) {
          return {
            ...b,
            ...(patch.label !== undefined ? { label: patch.label } : {}),
            ...(patch.href !== undefined ? { href: patch.href } : {}),
          }
        }
      }
      if (b.type === 'footer_disclaimer' && patch.text !== undefined) {
        return { ...b, text: patch.text }
      }
    }
    return b
  })
}
