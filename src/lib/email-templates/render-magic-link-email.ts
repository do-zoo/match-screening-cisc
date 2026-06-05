import { EmailTemplateKey } from '@prisma/client'

import { CLUB_EMAIL_DEFAULT_BODIES } from '@/lib/email-templates/default-bodies'
import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { parseStoredEmailBody } from '@/lib/email-templates/parse-stored-email-body'
import { loadClubEmailTemplates } from '@/lib/email-templates/load-club-email-templates'
import { renderEmailFromBlocks } from '@/lib/email-templates/render-email-from-blocks'
import { loadPublicClubBranding, pickClubEmailContact } from '@/lib/public/load-club-branding'

export async function resolveMagicLinkEmailContent(url: string): Promise<{
  subject: string
  text: string
  html: string
}> {
  const [templates, branding] = await Promise.all([loadClubEmailTemplates(), loadPublicClubBranding()])
  const fromDb = templates[EmailTemplateKey.magic_link] ?? null
  const entry = getEmailTemplateEntry(EmailTemplateKey.magic_link)
  const defaults = CLUB_EMAIL_DEFAULT_BODIES.magic_link

  const subject = fromDb?.subject ?? defaults.subject
  const blocks = fromDb?.blocks ?? parseStoredEmailBody(EmailTemplateKey.magic_link, defaults.body)
  const vars = {
    magic_link_url: url,
    club_name_nav: branding.clubNameNav,
  }

  try {
    return await renderEmailFromBlocks({
      key: EmailTemplateKey.magic_link,
      subject,
      blocks,
      vars,
      clubNameNav: branding.clubNameNav,
      logoBlobUrl: branding.logoBlobUrl,
      contact: pickClubEmailContact(branding),
    })
  } catch {
    return await renderEmailFromBlocks({
      key: EmailTemplateKey.magic_link,
      subject: defaults.subject,
      blocks: entry.defaultBlocks,
      vars,
      clubNameNav: branding.clubNameNav,
      logoBlobUrl: branding.logoBlobUrl,
      contact: pickClubEmailContact(branding),
    })
  }
}
