import type { EmailBlock } from '@/lib/email-templates/email-block-types'

export function stripBrandingHeaderBlocks(blocks: EmailBlock[]): EmailBlock[] {
  return blocks.filter(b => b.type !== 'branding_header')
}
