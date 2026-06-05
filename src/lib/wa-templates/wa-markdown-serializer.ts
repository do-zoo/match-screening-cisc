import type { JSONContent } from '@tiptap/core'

import type { WaTemplateCatalogEntry } from '@/lib/wa-templates/wa-template-catalog'

const PLACEHOLDER_RE = /^\{([a-z][a-z0-9_]*)\}/

function parseInline(text: string, allowedTokens: Set<string>): JSONContent[] {
  if (text.length === 0) return []

  const nodes: JSONContent[] = []
  let i = 0

  while (i < text.length) {
    const rest = text.slice(i)

    const ph = rest.match(PLACEHOLDER_RE)
    if (ph) {
      const token = ph[1]!
      nodes.push({
        type: 'waPlaceholder',
        attrs: { token, invalid: !allowedTokens.has(token) },
      })
      i += ph[0].length
      continue
    }

    if (rest.startsWith('`')) {
      const end = rest.indexOf('`', 1)
      if (end > 0) {
        nodes.push({
          type: 'text',
          text: rest.slice(1, end),
          marks: [{ type: 'code' }],
        })
        i += end + 1
        continue
      }
    }

    if (rest.startsWith('*')) {
      const end = rest.indexOf('*', 1)
      if (end > 1) {
        nodes.push({
          type: 'text',
          text: rest.slice(1, end),
          marks: [{ type: 'bold' }],
        })
        i += end + 1
        continue
      }
    }

    if (rest.startsWith('_')) {
      const end = rest.indexOf('_', 1)
      if (end > 1) {
        nodes.push({
          type: 'text',
          text: rest.slice(1, end),
          marks: [{ type: 'italic' }],
        })
        i += end + 1
        continue
      }
    }

    if (rest.startsWith('~')) {
      const end = rest.indexOf('~', 1)
      if (end > 1) {
        nodes.push({
          type: 'text',
          text: rest.slice(1, end),
          marks: [{ type: 'strike' }],
        })
        i += end + 1
        continue
      }
    }

    const nextSpecial = findNextSpecialIndex(rest)
    const plainEnd = nextSpecial === -1 ? rest.length : nextSpecial
    if (plainEnd > 0) {
      nodes.push({ type: 'text', text: rest.slice(0, plainEnd) })
      i += plainEnd
      continue
    }

    nodes.push({ type: 'text', text: rest[0] })
    i += 1
  }

  return nodes
}

function findNextSpecialIndex(text: string): number {
  const indices = ['{', '`', '*', '_', '~'].map(ch => text.indexOf(ch)).filter(n => n >= 0)
  if (indices.length === 0) return -1
  return Math.min(...indices)
}

function serializeInline(nodes: JSONContent[] | undefined): string {
  if (!nodes?.length) return ''
  return nodes
    .map(node => {
      if (node.type === 'waPlaceholder') {
        const token = node.attrs?.token as string
        return `{${token}}`
      }
      if (node.type !== 'text' || typeof node.text !== 'string') return ''
      let t = node.text
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') t = `*${t}*`
        else if (mark.type === 'italic') t = `_${t}_`
        else if (mark.type === 'strike') t = `~${t}~`
        else if (mark.type === 'code') t = `\`${t}\``
      }
      return t
    })
    .join('')
}

function serializeBlock(node: JSONContent): string {
  if (node.type === 'paragraph') {
    return serializeInline(node.content)
  }
  if (node.type === 'bulletList') {
    return (node.content ?? [])
      .map(item => {
        const para = item.content?.[0]
        return `- ${serializeInline(para?.content)}`
      })
      .join('\n')
  }
  if (node.type === 'orderedList') {
    return (node.content ?? [])
      .map((item, idx) => {
        const para = item.content?.[0]
        return `${idx + 1}. ${serializeInline(para?.content)}`
      })
      .join('\n')
  }
  if (node.type === 'blockquote') {
    return (node.content ?? [])
      .map(inner => `> ${serializeBlock(inner)}`)
      .join('\n')
  }
  return ''
}

export function docToWaMarkdown(doc: JSONContent): string {
  const blocks = doc.content ?? []
  const lines: string[] = []
  for (const block of blocks) {
    const serialized = serializeBlock(block)
    if (block.type === 'paragraph' && serialized === '') {
      lines.push('')
    } else if (serialized.includes('\n')) {
      lines.push(...serialized.split('\n'))
    } else {
      lines.push(serialized)
    }
  }
  return lines.join('\n')
}

function parseMarkdownLines(lines: string[], allowedTokens: Set<string>): JSONContent[] {
  const blocks: JSONContent[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    if (line === '') {
      blocks.push({ type: 'paragraph' })
      i += 1
      continue
    }

    if (/^[-*] /.test(line)) {
      const items: JSONContent[] = []
      while (i < lines.length && /^[-*] /.test(lines[i]!)) {
        const itemText = lines[i]!.replace(/^[-*] /, '')
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInline(itemText, allowedTokens) }],
        })
        i += 1
      }
      blocks.push({ type: 'bulletList', content: items })
      continue
    }

    if (/^\d+\. /.test(line)) {
      const items: JSONContent[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i]!)) {
        const itemText = lines[i]!.replace(/^\d+\. /, '')
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInline(itemText, allowedTokens) }],
        })
        i += 1
      }
      blocks.push({ type: 'orderedList', content: items })
      continue
    }

    if (line.startsWith('> ')) {
      blocks.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: parseInline(line.slice(2), allowedTokens),
          },
        ],
      })
      i += 1
      continue
    }

    blocks.push({
      type: 'paragraph',
      content: parseInline(line, allowedTokens),
    })
    i += 1
  }

  return blocks
}

export function waMarkdownToDoc(markdown: string, entry: WaTemplateCatalogEntry): JSONContent {
  const allowedTokens = new Set([...entry.requiredTokens, ...entry.optionalTokens])
  const content = parseMarkdownLines(markdown.split('\n'), allowedTokens)
  return { type: 'doc', content }
}
