import type { JSONContent } from '@tiptap/core'

import { EMAIL_PLACEHOLDER_TOKEN } from '@/lib/email-templates/email-placeholder'
import { applyEmailPlaceholders } from '@/lib/email-templates/email-placeholder'

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export function emptyEmailDoc(): JSONContent {
  return structuredClone(EMPTY_DOC)
}

export function plainTextToEmailDoc(text: string): JSONContent {
  const lines = text.split('\n')
  const content: JSONContent[] = []

  for (const line of lines) {
    content.push({
      type: 'paragraph',
      content: parseInlineToNodes(line),
    })
  }

  if (content.length === 0) {
    return emptyEmailDoc()
  }

  return { type: 'doc', content }
}

function parseInlineToNodes(text: string): JSONContent[] {
  if (text.length === 0) return []

  const nodes: JSONContent[] = []
  let i = 0
  const re = new RegExp(EMAIL_PLACEHOLDER_TOKEN.source, EMAIL_PLACEHOLDER_TOKEN.flags)

  while (i < text.length) {
    const rest = text.slice(i)
    re.lastIndex = 0
    const match = re.exec(rest)
    if (match && match.index === 0) {
      nodes.push({
        type: 'emailPlaceholder',
        attrs: { token: match[1], invalid: false },
      })
      i += match[0].length
      continue
    }

    const nextBrace = rest.indexOf('{')
    const end = nextBrace === -1 ? rest.length : nextBrace
    if (end > 0) {
      nodes.push({ type: 'text', text: rest.slice(0, end) })
    }
    i += end > 0 ? end : 1
  }

  return nodes
}

export function collectTokensFromDoc(doc: JSONContent): string[] {
  const found = new Set<string>()
  walkDoc(doc, node => {
    if (node.type === 'emailPlaceholder' && typeof node.attrs?.token === 'string') {
      found.add(node.attrs.token)
    }
    if (node.type === 'text' && typeof node.text === 'string') {
      const re = new RegExp(EMAIL_PLACEHOLDER_TOKEN.source, EMAIL_PLACEHOLDER_TOKEN.flags)
      for (const m of node.text.matchAll(re)) {
        found.add(m[1]!)
      }
    }
  })
  return [...found]
}

export function emailDocToPlainText(doc: JSONContent, vars: Record<string, string>): string {
  const parts: string[] = []

  for (const block of doc.content ?? []) {
    if (block.type === 'paragraph') {
      parts.push(inlineNodesToPlain(block.content ?? [], vars))
    }
    if (block.type === 'bulletList') {
      for (const item of block.content ?? []) {
        const line = inlineNodesToPlain(item.content?.[0]?.content ?? [], vars)
        parts.push(`- ${line}`)
      }
    }
    if (block.type === 'orderedList') {
      let n = 1
      for (const item of block.content ?? []) {
        const line = inlineNodesToPlain(item.content?.[0]?.content ?? [], vars)
        parts.push(`${n}. ${line}`)
        n += 1
      }
    }
  }

  return applyEmailPlaceholders(parts.join('\n'), vars)
}

function inlineNodesToPlain(nodes: JSONContent[], vars: Record<string, string>): string {
  let raw = ''
  for (const node of nodes) {
    if (node.type === 'text') raw += node.text ?? ''
    if (node.type === 'emailPlaceholder' && typeof node.attrs?.token === 'string') {
      raw += `{${node.attrs.token}}`
    }
  }
  return applyEmailPlaceholders(raw, vars)
}

function walkDoc(node: JSONContent, visit: (n: JSONContent) => void): void {
  visit(node)
  for (const child of node.content ?? []) {
    walkDoc(child, visit)
  }
}
