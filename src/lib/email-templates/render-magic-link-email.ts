import { EmailTemplateKey } from '@prisma/client'

import { CLUB_EMAIL_DEFAULT_BODIES } from '@/lib/email-templates/default-bodies'
import { applyEmailPlaceholders } from '@/lib/email-templates/email-placeholder'
import { loadClubEmailTemplates } from '@/lib/email-templates/load-club-email-templates'
import { loadPublicClubBranding } from '@/lib/public/load-club-branding'

export async function resolveMagicLinkEmailContent(url: string): Promise<{
  subject: string
  text: string
  introText: string
}> {
  const [templates, branding] = await Promise.all([loadClubEmailTemplates(), loadPublicClubBranding()])
  const fromDb = templates[EmailTemplateKey.magic_link] ?? null
  const defaults = CLUB_EMAIL_DEFAULT_BODIES.magic_link
  const vars = {
    magic_link_url: url,
    club_name_nav: branding.clubNameNav,
  }

  const subjectBody = fromDb
    ? (() => {
        try {
          return {
            subject: applyEmailPlaceholders(fromDb.subject, vars),
            text: applyEmailPlaceholders(fromDb.body, vars),
          }
        } catch {
          return null
        }
      })()
    : null

  const resolved =
    subjectBody ??
    (() => {
      try {
        return {
          subject: applyEmailPlaceholders(defaults.subject, vars),
          text: applyEmailPlaceholders(defaults.body, vars),
        }
      } catch {
        return {
          subject: 'Link masuk Match Screening',
          text: `Klik link berikut untuk masuk ke Match Screening:\n\n${url}\n\nLink berlaku 5 menit.`,
        }
      }
    })()

  const introText = resolved.text.split('\n').filter(line => !line.includes(url))[0]?.trim() || resolved.text

  return { subject: resolved.subject, text: resolved.text, introText }
}
