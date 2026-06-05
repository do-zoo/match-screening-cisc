import {
  EmailTemplateKey,
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
} from '@prisma/client'

import { prisma } from '@/lib/db/prisma'
import { buildTicketLineItems } from '@/lib/email-templates/email-transaction-line-items'
import { renderInvoiceUnderpaymentEmail } from '@/lib/email-templates/render-invoice-email'
import { loadClubEmailTemplates } from '@/lib/email-templates/load-club-email-templates'
import { sendTransactionalEmail } from '@/lib/auth/send-transactional-email'
import { isTransactionalEmailConfigured } from '@/lib/auth/transactional-email-config'
import { loadClubNotificationPreferences } from '@/lib/public/load-club-notification-preferences'
import { resolveOutboundNotifyBehaviour } from '@/lib/notifications/notification-outbound-mode'

export type SendInvoiceEmailResult = { ok: true; dryRun?: boolean } | { ok: false; error: string }

export async function sendInvoiceEmailForRegistration(opts: {
  registrationId: string
  eventId: string
  actorAuthUserId: string
  actorProfileId: string | null
}): Promise<SendInvoiceEmailResult> {
  const [registration, templates, prefs] = await Promise.all([
    prisma.registration.findFirst({
      where: { id: opts.registrationId, eventId: opts.eventId },
      select: {
        id: true,
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
            bankAccount: { select: { bankName: true, accountNumber: true, accountName: true } },
          },
        },
        adjustments: {
          where: {
            type: InvoiceAdjustmentType.underpayment,
            status: InvoiceAdjustmentStatus.unpaid,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { amount: true },
        },
      },
    }),
    loadClubEmailTemplates(),
    loadClubNotificationPreferences(),
  ])

  if (!registration) return { ok: false, error: 'Pendaftaran tidak ditemukan.' }
  if (!registration.contactEmail) return { ok: false, error: 'Email kontak belum diisi.' }
  const adj = registration.adjustments[0]
  if (!adj) return { ok: false, error: 'Tidak ada tagihan kekurangan yang belum lunas.' }

  const bank = registration.event.bankAccount
  const registrationTotal = registration.computedTotalAtSubmit
  const shortfall = adj.amount
  const inferredPaid =
    shortfall < registrationTotal ? registrationTotal - shortfall : undefined

  const { subject, text, html } = await renderInvoiceUnderpaymentEmail(
    templates[EmailTemplateKey.invoice_underpayment] ?? null,
    {
      contactName: registration.contactName,
      eventTitle: registration.event.title,
      adjustmentAmountIdr: shortfall,
      registrationTotalIdr: registrationTotal,
      amountPaidIdr: inferredPaid,
      bankName: bank?.bankName ?? '',
      accountNumber: bank?.accountNumber ?? '',
      accountName: bank?.accountName ?? '',
      registrationId: registration.id,
      ticketCategoryName: registration.ticketCategory.name,
      ticketQty: registration.ticketQty,
      ticketLineItems: buildTicketLineItems(registration.tickets),
    },
  )

  const behaviour = resolveOutboundNotifyBehaviour(prefs.outboundMode)
  if (!behaviour.shouldAttemptProviderSend) {
    if (behaviour.shouldLogToConsole) {
      console.log('[email-invoice]', {
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
        templateKey: EmailTemplateKey.invoice_underpayment,
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
        templateKey: EmailTemplateKey.invoice_underpayment,
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
