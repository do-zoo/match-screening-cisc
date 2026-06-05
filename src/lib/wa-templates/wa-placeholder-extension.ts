import { Node, mergeAttributes } from '@tiptap/core'

import type { WaTokenMeta } from '@/lib/wa-templates/wa-template-catalog'

export type WaPlaceholderOptions = {
  allowedTokens: Set<string>
  requiredTokens: Set<string>
  tokenMeta: Record<string, WaTokenMeta>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    waPlaceholder: {
      insertWaPlaceholder: (token: string) => ReturnType
    }
  }
}

export const WaPlaceholder = Node.create<WaPlaceholderOptions>({
  name: 'waPlaceholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      allowedTokens: new Set<string>(),
      requiredTokens: new Set<string>(),
      tokenMeta: {},
    }
  },

  addAttributes() {
    return {
      token: { default: null as string | null },
      invalid: { default: false },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-wa-placeholder]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const token = (node.attrs.token as string) ?? ''
    const invalid = Boolean(node.attrs.invalid)
    const required = this.options.requiredTokens.has(token)
    const label = this.options.tokenMeta[token]?.labelId ?? token
    const classes = [
      'wa-placeholder-chip',
      invalid ? 'wa-placeholder-chip--invalid' : required ? 'wa-placeholder-chip--required' : 'wa-placeholder-chip--optional',
    ].join(' ')

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wa-placeholder': token,
        'data-required': required ? 'true' : 'false',
        class: classes,
        contenteditable: 'false',
      }),
      label,
    ]
  },

  addCommands() {
    return {
      insertWaPlaceholder:
        (token: string) =>
        ({ chain }) => {
          const invalid = !this.options.allowedTokens.has(token)
          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: { token, invalid },
            })
            .run()
        },
    }
  },
})
