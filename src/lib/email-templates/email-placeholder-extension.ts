import { Node, mergeAttributes } from '@tiptap/core'

import type { EmailTokenMeta } from '@/lib/email-templates/email-template-catalog'

export type EmailPlaceholderOptions = {
  allowedTokens: Set<string>
  requiredTokens: Set<string>
  tokenMeta: Record<string, EmailTokenMeta>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    emailPlaceholder: {
      insertEmailPlaceholder: (token: string) => ReturnType
    }
  }
}

export const EmailPlaceholder = Node.create<EmailPlaceholderOptions>({
  name: 'emailPlaceholder',
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
    return [{ tag: 'span[data-email-placeholder]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const token = (node.attrs.token as string) ?? ''
    const invalid = Boolean(node.attrs.invalid)
    const required = this.options.requiredTokens.has(token)
    const label = this.options.tokenMeta[token]?.labelId ?? token
    const classes = [
      'email-placeholder-chip',
      invalid
        ? 'email-placeholder-chip--invalid'
        : required
          ? 'email-placeholder-chip--required'
          : 'email-placeholder-chip--optional',
    ].join(' ')

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-email-placeholder': token,
        'data-required': required ? 'true' : 'false',
        class: classes,
        contenteditable: 'false',
      }),
      label,
    ]
  },

  addCommands() {
    return {
      insertEmailPlaceholder:
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
