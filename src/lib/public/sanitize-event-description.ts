import sanitizeHtml from 'sanitize-html'

import { isAllowedEventDescriptionImageSrc } from '@/lib/public/event-description-image-src'

export function sanitizePublicEventDescriptionHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'ul',
      'ol',
      'li',
      'a',
      'h2',
      'h3',
      'h4',
      'blockquote',
      'div',
      'span',
      'img',
      'hr',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'loading', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['https'],
    },
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    selfClosing: ['img', 'br', 'hr'],
    disallowedTagsMode: 'discard',
    exclusiveFilter(frame) {
      if (frame.tag === 'img') {
        return !isAllowedEventDescriptionImageSrc(frame.attribs.src)
      }
      return false
    },
    transformTags: {
      img(tagName, attribs) {
        const src = attribs.src?.trim() ?? ''
        const next: Record<string, string> = {
          src,
          loading: 'lazy',
        }
        const alt = typeof attribs.alt === 'string' ? attribs.alt.trim() : ''
        if (alt) next.alt = alt.slice(0, 500)
        const w = attribs.width?.trim()
        const h = attribs.height?.trim()
        if (w && /^\d+$/.test(w)) next.width = w
        if (h && /^\d+$/.test(h)) next.height = h
        return { tagName, attribs: next }
      },
    },
  })
}
