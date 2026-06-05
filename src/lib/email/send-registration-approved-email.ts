import { EmailTemplateKey, RegistrationStatus } from '@prisma/client'

import { prisma } from '@/lib/db/prisma'
import { buildTicketLineItems } from '@/lib/email-templates/email-transaction-line-items'
import { renderRegistrationApprovedEmail } from '@/lib/email-templates/render-registration-approved-email'
import { loadClubEmailTemplates } from '@/lib/email-templates/load-club-email-templates'
import { sendTransactionalEmail } from '@/lib/auth/send-transactional-email'
import { isTransactionalEmailConfigured } from '@/lib/auth/transactional-email-config'
import { loadClubNotificationPreferences } from '@/lib/public/load-club-notification-preferences'
import { resolveOutboundNotifyBehaviour } from '@/lib/notifications/notification-outbound-mode'

export type SendRegistrationApprovedEmailResult =
  | { ok: true; dryRun?: boolean; skipped?: 'no_email' | 'wrong_status' }
  | { ok: false; error: string }

export async function sendRegistrationApprovedEmailForRegistration(opts: {
  registrationId: string
  eventId: string
  actorAuthUserId: string
  actorProfileId: string | null
}): Promise<SendRegistrationApprovedEmailResult> {
  const [registration, templates, prefs] = await Promise.all([
    prisma.registration.findFirst({
      where: { id: opts.registrationId, eventId: opts.eventId },
      select: {
        id: true,
        status: true,
        contactName: true,
        contactEmail: true,
        computedTotalAtSubmit: true,
        ticketQty: true,
        ticketCategory: { select: { name: true } },
        tickets: {
          orderBy: { sortOrder: 'asc' },
          select: {
            sortOrder: true,
            ticketPriceApplied: true,
            assignedHolder: { select: { holderName: true } },
            mandatoryMenuItem: { select: { name: true } },
          },
        },
        event: {
          select: {
            title: true,
            kickOffAt: true,
            openGateAt: true,
            venue: { select: { name: true } },
          },
        },
      },
    }),
    loadClubEmailTemplates(),
    loadClubNotificationPreferences(),
  ])

  if (!registration) return { ok: false, error: 'Pendaftaran tidak ditemukan.' }
  if (registration.status !== RegistrationStatus.approved) {
    return { ok: true, skipped: 'wrong_status' }
  }
  if (!registration.contactEmail) return { ok: true, skipped: 'no_email' }

  const { subject, text, html } = await renderRegistrationApprovedEmail(
    templates[EmailTemplateKey.registration_approved] ?? null,
    {
      contactName: registration.contactName,
      eventTitle: registration.event.title,
      registrationId: registration.id,
      computedTotalIdr: registration.computedTotalAtSubmit,
      ticketQty: registration.ticketQty,
      ticketCategoryName: registration.ticketCategory.name,
      venue: registration.event.venue.name,
      kickOffAt: registration.event.kickOffAt,
      openGateAt: registration.event.openGateAt,
      ticketLineItems: buildTicketLineItems(registration.tickets),
    },
  )

  const behaviour = resolveOutboundNotifyBehaviour(prefs.outboundMode)
  if (!behaviour.shouldAttemptProviderSend) {
    if (behaviour.shouldLogToConsole) {
      console.log('[email-registration-approved]', {
        registrationId: registration.id,
        to: registration.contactEmail,
        subject,
      })
    }
    return { ok: true, dryRun: true }
  }

  if (!isTransactionalEmailConfigured()) {
    return { ok: false, error: 'Email pengiriman belum dikonfigurasi.' }
  }

  try {
    await sendTransactionalEmail({
      to: registration.contactEmail,
      subject,
      text,
      html,
    })
    await prisma.emailDeliveryLog.create({
      data: {
        eventId: opts.eventId,
        registrationId: registration.id,
        templateKey: EmailTemplateKey.registration_approved,
        toEmail: registration.contactEmail,
        success: true,
        actorAuthUserId: opts.actorAuthUserId,
        actorAdminProfileId: opts.actorProfileId,
      },
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Gagal mengirim email.'
    await prisma.emailDeliveryLog.create({
      data: {
        eventId: opts.eventId,
        registrationId: registration.id,
        templateKey: EmailTemplateKey.registration_approved,
        toEmail: registration.contactEmail,
        success: false,
        errorMessage: message.slice(0, 500),
        actorAuthUserId: opts.actorAuthUserId,
        actorAdminProfileId: opts.actorProfileId,
      },
    })
    return { ok: false, error: message }
  }
}
