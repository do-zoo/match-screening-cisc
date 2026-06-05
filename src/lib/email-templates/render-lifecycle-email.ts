import { EmailTemplateKey } from '@prisma/client'

import { CLUB_EMAIL_DEFAULT_BODIES } from '@/lib/email-templates/default-bodies'
import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { parseStoredEmailBody } from '@/lib/email-templates/parse-stored-email-body'
import { renderEmailFromBlocks } from '@/lib/email-templates/render-email-from-blocks'
import { loadPublicClubBranding, pickClubEmailContact } from '@/lib/public/load-club-branding'

const LIFECYCLE_KEYS = new Set<EmailTemplateKey>([
  EmailTemplateKey.receipt,
  EmailTemplateKey.rejected,
  EmailTemplateKey.payment_issue,
  EmailTemplateKey.cancelled,
  EmailTemplateKey.refunded,
  EmailTemplateKey.otp,
  EmailTemplateKey.admin_invite,
])

export async function renderLifecycleEmail(
  key: EmailTemplateKey,
  fromDb: { subject: string; body: string } | { subject: string; blocks: EmailBlock[] } | null,
  vars: Record<string, string>,
): Promise<{ subject: string; text: string; html: string }> {
  if (!LIFECYCLE_KEYS.has(key)) {
    throw new Error(`Bukan template lifecycle: ${key}`)
  }

  const entry = getEmailTemplateEntry(key)
  const defaults = CLUB_EMAIL_DEFAULT_BODIES[key]

  const subject = fromDb?.subject ?? defaults.subject
  const blocks =
    fromDb && 'blocks' in fromDb
      ? fromDb.blocks
      : fromDb
        ? parseStoredEmailBody(key, fromDb.body)
        : entry.defaultBlocks

  const branding = await loadPublicClubBranding()
  const renderOpts = {
    key,
    subject,
    blocks,
    vars: { ...vars, club_name_nav: branding.clubNameNav },
    clubNameNav: branding.clubNameNav,
    logoBlobUrl: branding.logoBlobUrl,
    contact: pickClubEmailContact(branding),
  }

  try {
    return await renderEmailFromBlocks(renderOpts)
  } catch {
    return await renderEmailFromBlocks({
      ...renderOpts,
      subject: defaults.subject,
      blocks: entry.defaultBlocks,
    })
  }
}
