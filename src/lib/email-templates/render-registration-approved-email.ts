import { EmailTemplateKey } from '@prisma/client'

import { CLUB_EMAIL_DEFAULT_BODIES } from '@/lib/email-templates/default-bodies'
import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { parseStoredEmailBody } from '@/lib/email-templates/parse-stored-email-body'
import { renderEmailFromBlocks } from '@/lib/email-templates/render-email-from-blocks'
import type { EmailTransactionLineItem } from '@/lib/email-templates/email-transaction-line-items'
import { withTransactionLineItems } from '@/lib/email-templates/email-transaction-line-items'
import { loadPublicClubBranding, pickClubEmailContact } from '@/lib/public/load-club-branding'
import { buildRegistrationEmailUrlVars } from '@/lib/email-templates/registration-email-url-vars'
import { formatWaIdr } from '@/lib/wa-templates/format-wa-idr'

export type RegistrationApprovedEmailCtx = {
  contactName: string
  eventTitle: string
  eventSlug: string
  registrationId: string
  computedTotalIdr: number
  ticketQty: number
  ticketCategoryName: string
  venue: string
  venueAddress: string
  venueMapUrl: string | null
  kickOffAt: Date
  ticketLineItems?: EmailTransactionLineItem[]
}

function formatEmailDateTime(d: Date): string {
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

function varsFromCtx(ctx: RegistrationApprovedEmailCtx): Record<string, string> {
  const vars: Record<string, string> = {
    contact_name: ctx.contactName,
    event_title: ctx.eventTitle,
    registration_id: ctx.registrationId,
    computed_total_idr: formatWaIdr(ctx.computedTotalIdr),
    ticket_qty: String(ctx.ticketQty),
    ticket_category_name: ctx.ticketCategoryName,
    venue: ctx.venue,
    venue_address: ctx.venueAddress,
    start_at_formatted: formatEmailDateTime(ctx.kickOffAt),
  }
  if (ctx.venueMapUrl?.trim()) {
    vars.venue_map_url = ctx.venueMapUrl.trim()
  }
  return withTransactionLineItems(
    {
      ...vars,
      ...buildRegistrationEmailUrlVars({
        origin: process.env.BETTER_AUTH_URL,
        eventSlug: ctx.eventSlug,
        registrationId: ctx.registrationId,
      }),
    },
    ctx.ticketLineItems ?? [],
  )
}

export async function renderRegistrationApprovedEmail(
  fromDb: { subject: string; body: string } | { subject: string; blocks: EmailBlock[] } | null,
  ctx: RegistrationApprovedEmailCtx,
): Promise<{ subject: string; text: string; html: string }> {
  const vars = varsFromCtx(ctx)
  const entry = getEmailTemplateEntry(EmailTemplateKey.registration_approved)
  const defaults = CLUB_EMAIL_DEFAULT_BODIES.registration_approved

  const subject = fromDb?.subject ?? defaults.subject
  const blocks =
    fromDb && 'blocks' in fromDb
      ? fromDb.blocks
      : fromDb
        ? parseStoredEmailBody(EmailTemplateKey.registration_approved, fromDb.body)
        : entry.defaultBlocks

  const branding = await loadPublicClubBranding()
  const renderOpts = {
    key: EmailTemplateKey.registration_approved,
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

export const REGISTRATION_APPROVED_EMAIL_TEMPLATE_KEY =
  'registration_approved' satisfies EmailTemplateKey
