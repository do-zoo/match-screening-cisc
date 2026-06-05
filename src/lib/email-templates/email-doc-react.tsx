import type { JSONContent } from '@tiptap/core'
import { Link, Text } from 'react-email'
import type { ReactNode } from 'react'
import { Fragment, createElement } from 'react'

import { EMAIL_DESIGN_TOKENS as T } from '@/lib/email-templates/email-design-tokens'
import { applyEmailPlaceholders } from '@/lib/email-templates/email-placeholder'
import { emailDocToPlainText } from '@/lib/email-templates/email-doc-serializer'

export function emailDocToReactNodes(doc: JSONContent, vars: Record<string, string>): ReactNode[] {
  const out: ReactNode[] = []

  for (const block of doc.content ?? []) {
    if (block.type === 'paragraph') {
      out.push(
        createElement(
          Text,
          {
            key: out.length,
            style: {
              color: T.bodyText,
              lineHeight: '1.65',
              margin: '0 0 14px',
              whiteSpace: 'pre-wrap' as const,
              fontSize: '15px',
            },
          },
          ...inlineNodesToReact(block.content ?? [], vars),
        ),
      )
    }
    if (block.type === 'bulletList') {
      for (const item of block.content ?? []) {
        const inner = item.content?.[0]
        const line =
          inner?.type === 'paragraph'
            ? emailDocToPlainText({ type: 'doc', content: [inner] }, vars)
            : ''
        out.push(
          createElement(
            Text,
            { key: out.length, style: { color: T.bodyText, lineHeight: '1.6', margin: '0 0 8px', fontSize: '16px' } },
            `• ${line}`,
          ),
        )
      }
    }
    if (block.type === 'orderedList') {
      let n = 1
      for (const item of block.content ?? []) {
        const inner = item.content?.[0]
        const line =
          inner?.type === 'paragraph'
            ? emailDocToPlainText({ type: 'doc', content: [inner] }, vars)
            : ''
        out.push(
          createElement(
            Text,
            { key: out.length, style: { color: T.bodyText, lineHeight: '1.6', margin: '0 0 8px', fontSize: '16px' } },
            `${n}. ${line}`,
          ),
        )
        n += 1
      }
    }
  }

  return out
}

function inlineNodesToReact(nodes: JSONContent[], vars: Record<string, string>): ReactNode[] {
  const parts: ReactNode[] = []
  let i = 0

  for (const node of nodes) {
    if (node.type === 'text' && node.text) {
      const text = applyEmailPlaceholders(node.text, vars)
      const marks = node.marks ?? []
      const isBold = marks.some(m => m.type === 'bold')
      const isItalic = marks.some(m => m.type === 'italic')
      const linkMark = marks.find(m => m.type === 'link')
      let el: ReactNode = text
      if (linkMark && typeof linkMark.attrs?.href === 'string') {
        el = createElement(Link, { href: linkMark.attrs.href, style: { color: T.accentLight } }, text)
      }
      if (isBold) el = createElement('strong', { key: `b-${i}` }, el)
      if (isItalic) el = createElement('em', { key: `i-${i}` }, el)
      parts.push(createElement(Fragment, { key: `t-${i}` }, el))
    }
    if (node.type === 'emailPlaceholder' && typeof node.attrs?.token === 'string') {
      parts.push(applyEmailPlaceholders(`{${node.attrs.token}}`, vars))
    }
    i += 1
  }

  return parts
}
