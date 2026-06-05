import type { JSONContent } from '@tiptap/core'
import { Link, Section, Text } from 'react-email'
import type { ReactNode } from 'react'
import { Fragment, createElement } from 'react'

import { EMAIL_DESIGN_TOKENS as T } from '@/lib/email-templates/email-design-tokens'
import { applyEmailPlaceholders } from '@/lib/email-templates/email-placeholder'
import { emailDocToPlainText } from '@/lib/email-templates/email-doc-serializer'

type ParagraphTextAlign = 'left' | 'center' | 'right' | 'justify'

function paragraphAlignStyle(attrs: JSONContent['attrs'] | undefined): ParagraphTextAlign | undefined {
  const align = attrs?.textAlign
  if (align === 'center' || align === 'right' || align === 'justify') return align
  return undefined
}

function paragraphTextStyle(attrs: JSONContent['attrs'] | undefined, marginBottom: string) {
  const align = paragraphAlignStyle(attrs)
  return {
    color: T.bodyText,
    lineHeight: '1.65',
    margin: `0 0 ${marginBottom}`,
    whiteSpace: 'pre-wrap' as const,
    fontSize: '15px',
    ...(align ? { textAlign: align } : {}),
  }
}

function isTrailingDocBlock(content: JSONContent[], index: number): boolean {
  for (let i = index + 1; i < content.length; i++) {
    const type = content[i]?.type
    if (type === 'paragraph' || type === 'bulletList' || type === 'orderedList' || type === 'blockquote') {
      return false
    }
  }
  return true
}

export function emailDocToReactNodes(doc: JSONContent, vars: Record<string, string>): ReactNode[] {
  const out: ReactNode[] = []

  const content = doc.content ?? []
  for (let blockIndex = 0; blockIndex < content.length; blockIndex++) {
    const block = content[blockIndex]!
    if (block.type === 'paragraph') {
      const marginBottom = isTrailingDocBlock(content, blockIndex) ? '0' : '8px'
      out.push(
        createElement(
          Text,
          {
            key: out.length,
            style: paragraphTextStyle(block.attrs, marginBottom),
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
    if (block.type === 'blockquote') {
      const quoteParagraphs = (block.content ?? []).filter(child => child.type === 'paragraph')
      if (quoteParagraphs.length > 0) {
        const quoteMargin = isTrailingDocBlock(content, blockIndex) ? '0' : '0 0 12px'
        out.push(
          createElement(
            Section,
            {
              key: out.length,
              style: {
                backgroundColor: T.blockquoteBg,
                borderLeft: `4px solid ${T.blockquoteBorder}`,
                borderRadius: '8px',
                margin: quoteMargin,
                padding: '14px 16px',
              },
            },
            ...quoteParagraphs.map((child, index) => {
              const align = paragraphAlignStyle(child.attrs)
              return createElement(
                Text,
                {
                  key: `bq-p-${index}`,
                  style: {
                    color: T.blockquoteText,
                    fontSize: '15px',
                    lineHeight: '1.65',
                    margin: index === 0 ? '0' : '8px 0 0',
                    whiteSpace: 'pre-wrap' as const,
                    ...(align ? { textAlign: align } : {}),
                  },
                },
                ...inlineNodesToReact(child.content ?? [], vars),
              )
            }),
          ),
        )
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
