import type { EmailTemplateKey } from '@prisma/client'
import { render } from 'react-email'
import { createElement } from 'react'

import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { blocksToPlainText, renderEmailBlocks } from '@/lib/email-templates/emails/club-email-blocks'
import { ClubEmailLayout } from '@/lib/email-templates/emails/club-email-layout'
import type { ClubEmailContactProps } from '@/lib/email-templates/emails/club-email-plain-contact'
import { applyEmailPlaceholders } from '@/lib/email-templates/email-placeholder'
import { getEmailTemplateEntry, sampleVarsFromCatalog } from '@/lib/email-templates/email-template-catalog'
import { stripBrandingHeaderBlocks } from '@/lib/email-templates/strip-branding-header-blocks'

export { sampleVarsFromCatalog }

const EMPTY_CONTACT: ClubEmailContactProps = {
  contactEmail: null,
  websiteUrl: null,
  locationText: null,
  socialLinks: [],
}

export async function renderEmailFromBlocks(opts: {
  key: EmailTemplateKey
  subject: string
  blocks: EmailBlock[]
  vars: Record<string, string>
  clubNameNav?: string
  logoBlobUrl?: string | null
  contact?: ClubEmailContactProps
}): Promise<{ subject: string; text: string; html: string }> {
  const entry = getEmailTemplateEntry(opts.key)
  const clubNameNav = opts.clubNameNav ?? opts.vars.club_name_nav ?? entry.tokenMeta.club_name_nav?.sampleValue ?? 'CISC'
  const vars = { ...opts.vars, club_name_nav: opts.vars.club_name_nav ?? clubNameNav }
  const contact = opts.contact ?? EMPTY_CONTACT
  const blocks = stripBrandingHeaderBlocks(opts.blocks)

  const subject = applyEmailPlaceholders(opts.subject.trim(), vars)
  const text = blocksToPlainText({ templateKey: opts.key, blocks, vars, contact })
  const html = await render(
    createElement(
      ClubEmailLayout,
      {
        preview: subject.slice(0, 80),
        clubNameNav,
        logoBlobUrl: opts.logoBlobUrl,
        contact,
        appOrigin: process.env.BETTER_AUTH_URL ?? null,
      },
      renderEmailBlocks({
        templateKey: opts.key,
        blocks,
        vars,
      }),
    ),
  )

  return { subject, text, html }
}
