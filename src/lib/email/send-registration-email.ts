import {
  EmailTemplateKey,
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
  RegistrationStatus,
} from '@prisma/client'

import { sendTransactionalEmail } from '@/lib/auth/send-transactional-email'
import { isTransactionalEmailConfigured } from '@/lib/auth/transactional-email-config'
import { prisma } from '@/lib/db/prisma'
import { canSendRegistrationEmail } from '@/lib/email/registration-email-eligibility'
import { buildTicketLineItems } from '@/lib/email-templates/email-transaction-line-items'
import { loadClubEmailTemplates } from '@/lib/email-templates/load-club-email-templates'
import {
  renderInvoiceUnderpaymentEmail,
  renderRegistrationInvoiceEmail,
} from '@/lib/email-templates/render-invoice-email'
import { renderLifecycleEmail } from '@/lib/email-templates/render-lifecycle-email'
import { renderRegistrationApprovedEmail } from '@/lib/email-templates/render-registration-approved-email'
import { loadClubNotificationPreferences } from '@/lib/public/load-club-notification-preferences'
import { resolveOutboundNotifyBehaviour } from '@/lib/notifications/notification-outbound-mode'
import { formatWaIdr } from '@/lib/wa-templates/format-wa-idr'

export type SendRegistrationEmailResult =
  | { ok: true; dryRun?: boolean; skipped?: string }
  | { ok: false; error: string }

const REGISTRATION_TEMPLATE_KEYS = new Set<EmailTemplateKey>([
  EmailTemplateKey.invoice,
  EmailTemplateKey.invoice_underpayment,
  EmailTemplateKey.registration_approved,
  EmailTemplateKey.receipt,
  EmailTemplateKey.rejected,
  EmailTemplateKey.payment_issue,
  EmailTemplateKey.cancelled,
  EmailTemplateKey.refunded,
])

async function loadRegistrationForEmail(registrationId: string, eventId: string) {
  return prisma.registration.findFirst({
    where: { id: registrationId, eventId },
    select: {
      id: true,
      status: true,
      contactName: true,
      contactEmail: true,
      computedTotalAtSubmit: true,
      ticketQty: true,
      rejectionReason: true,
      paymentIssueReason: true,
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
      adjustments: {
        where: {
          type: InvoiceAdjustmentType.underpayment,
          status: InvoiceAdjustmentStatus.unpaid,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { amount: true },
      },
      event: {
        select: {
          title: true,
          kickOffAt: true,
          openGateAt: true,
          venue: { select: { name: true } },
          bankAccount: { select: { bankName: true, accountNumber: true, accountName: true } },
        },
      },
    },
  })
}

type LoadedRegistration = NonNullable<Awaited<ReturnType<typeof loadRegistrationForEmail>>>

function eligibilityInput(reg: LoadedRegistration) {
  return {
    status: reg.status,
    contactEmail: reg.contactEmail,
    hasUnpaidUnderpayment: reg.adjustments.length > 0,
    rejectionReason: reg.rejectionReason,
    paymentIssueReason: reg.paymentIssueReason,
  }
}

async function renderForKey(
  templateKey: EmailTemplateKey,
  fromDb: Awaited<ReturnType<typeof loadClubEmailTemplates>>[EmailTemplateKey] | undefined,
  reg: LoadedRegistration,
) {
  const bank = reg.event.bankAccount
  const ticketLineItems = buildTicketLineItems(reg.tickets)

  switch (templateKey) {
    case EmailTemplateKey.invoice:
      return renderRegistrationInvoiceEmail(fromDb ?? null, {
        contactName: reg.contactName,
        eventTitle: reg.event.title,
        totalAmountIdr: reg.computedTotalAtSubmit,
        bankName: bank?.bankName ?? '',
        accountNumber: bank?.accountNumber ?? '',
        accountName: bank?.accountName ?? '',
        registrationId: reg.id,
        ticketCategoryName: reg.ticketCategory.name,
        ticketQty: reg.ticketQty,
        ticketLineItems,
      })
    case EmailTemplateKey.invoice_underpayment: {
      const adj = reg.adjustments[0]!
      const registrationTotal = reg.computedTotalAtSubmit
      const shortfall = adj.amount
      const inferredPaid =
        shortfall < registrationTotal ? registrationTotal - shortfall : undefined
      return renderInvoiceUnderpaymentEmail(fromDb ?? null, {
        contactName: reg.contactName,
        eventTitle: reg.event.title,
        adjustmentAmountIdr: shortfall,
        registrationTotalIdr: registrationTotal,
        amountPaidIdr: inferredPaid,
        bankName: bank?.bankName ?? '',
        accountNumber: bank?.accountNumber ?? '',
        accountName: bank?.accountName ?? '',
        registrationId: reg.id,
        ticketCategoryName: reg.ticketCategory.name,
        ticketQty: reg.ticketQty,
        ticketLineItems,
      })
    }
    case EmailTemplateKey.registration_approved:
      return renderRegistrationApprovedEmail(fromDb ?? null, {
        contactName: reg.contactName,
        eventTitle: reg.event.title,
        registrationId: reg.id,
        computedTotalIdr: reg.computedTotalAtSubmit,
        ticketQty: reg.ticketQty,
        ticketCategoryName: reg.ticketCategory.name,
        venue: reg.event.venue.name,
        kickOffAt: reg.event.kickOffAt,
        openGateAt: reg.event.openGateAt,
        ticketLineItems,
      })
    case EmailTemplateKey.receipt:
    case EmailTemplateKey.rejected:
    case EmailTemplateKey.payment_issue:
    case EmailTemplateKey.cancelled:
    case EmailTemplateKey.refunded: {
      const vars: Record<string, string> = {
        contact_name: reg.contactName,
        event_title: reg.event.title,
        registration_id: reg.id,
        computed_total_idr: formatWaIdr(reg.computedTotalAtSubmit),
        ticket_qty: String(reg.ticketQty),
        ticket_category_name: reg.ticketCategory.name,
      }
      if (reg.rejectionReason?.trim()) vars.reason = reg.rejectionReason.trim()
      if (reg.paymentIssueReason?.trim()) vars.reason = reg.paymentIssueReason.trim()
      return renderLifecycleEmail(templateKey, fromDb ?? null, vars)
    }
    default:
      throw new Error(`Template tidak didukung: ${templateKey}`)
  }
}

export async function previewRegistrationEmailContent(opts: {
  registrationId: string
  eventId: string
  templateKey: EmailTemplateKey
}): Promise<{ subject: string; text: string } | { error: string }> {
  if (!REGISTRATION_TEMPLATE_KEYS.has(opts.templateKey)) {
    return { error: 'Template tidak valid.' }
  }

  const [reg, templates] = await Promise.all([
    loadRegistrationForEmail(opts.registrationId, opts.eventId),
    loadClubEmailTemplates(),
  ])

  if (!reg) return { error: 'Pendaftaran tidak ditemukan.' }
  if (!canSendRegistrationEmail(eligibilityInput(reg), opts.templateKey)) {
    return { error: 'Email tidak dapat dipratinjau untuk registrasi ini.' }
  }

  const { subject, text } = await renderForKey(opts.templateKey, templates[opts.templateKey], reg)
  return { subject, text }
}

export async function sendRegistrationEmailByKey(opts: {
  registrationId: string
  eventId: string
  templateKey: EmailTemplateKey
  actorAuthUserId: string
  actorProfileId: string | null
}): Promise<SendRegistrationEmailResult> {
  if (!REGISTRATION_TEMPLATE_KEYS.has(opts.templateKey)) {
    return { ok: false, error: 'Template email tidak valid untuk registrasi.' }
  }

  const [reg, templates, prefs] = await Promise.all([
    loadRegistrationForEmail(opts.registrationId, opts.eventId),
    loadClubEmailTemplates(),
    loadClubNotificationPreferences(),
  ])

  if (!reg) return { ok: false, error: 'Pendaftaran tidak ditemukan.' }

  const input = eligibilityInput(reg)
  if (!canSendRegistrationEmail(input, opts.templateKey)) {
    if (!reg.contactEmail?.trim()) return { ok: true, skipped: 'no_email' }
    return { ok: false, error: 'Registrasi tidak memenuhi syarat untuk template email ini.' }
  }

  const { subject, text, html } = await renderForKey(opts.templateKey, templates[opts.templateKey], reg)

  const behaviour = resolveOutboundNotifyBehaviour(prefs.outboundMode)
  const logTag = `email-${opts.templateKey}`

  if (!behaviour.shouldAttemptProviderSend) {
    if (behaviour.shouldLogToConsole) {
      console.log(`[${logTag}]`, {
        registrationId: reg.id,
        to: reg.contactEmail,
        subject,
      })
    }
    return { ok: true, dryRun: true }
  }

  if (!isTransactionalEmailConfigured()) {
    return { ok: false, error: 'Email pengiriman belum dikonfigurasi.' }
  }

  const toEmail = reg.contactEmail!.trim()

  try {
    await sendTransactionalEmail({ to: toEmail, subject, text, html })
    await prisma.emailDeliveryLog.create({
      data: {
        eventId: opts.eventId,
        registrationId: reg.id,
        templateKey: opts.templateKey,
        toEmail,
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
        registrationId: reg.id,
        templateKey: opts.templateKey,
        toEmail,
        success: false,
        errorMessage: message.slice(0, 500),
        actorAuthUserId: opts.actorAuthUserId,
        actorProfileId: opts.actorProfileId,
      },
    })
    return { ok: false, error: message }
  }
}

export async function trySendReceiptEmailAfterSubmit(opts: {
  registrationId: string
  eventId: string
}): Promise<SendRegistrationEmailResult | null> {
  const prefs = await loadClubNotificationPreferences()
  if (!prefs.emailAutoOnSubmitReceipt) return null
  try {
    return await sendRegistrationEmailByKey({
      registrationId: opts.registrationId,
      eventId: opts.eventId,
      templateKey: EmailTemplateKey.receipt,
      actorAuthUserId: 'public-registration',
      actorProfileId: null,
    })
  } catch {
    return { ok: false, error: 'Gagal mengirim email penerimaan.' }
  }
}

export function emailKeyForStatusAction(
  status: RegistrationStatus,
): EmailTemplateKey | null {
  switch (status) {
    case RegistrationStatus.approved:
      return EmailTemplateKey.registration_approved
    case RegistrationStatus.rejected:
      return EmailTemplateKey.rejected
    case RegistrationStatus.payment_issue:
      return EmailTemplateKey.payment_issue
    case RegistrationStatus.cancelled:
      return EmailTemplateKey.cancelled
    case RegistrationStatus.refunded:
      return EmailTemplateKey.refunded
    default:
      return null
  }
}

export async function maybeAutoSendRegistrationEmail(opts: {
  registrationId: string
  eventId: string
  templateKey: EmailTemplateKey
  enabled: boolean
  actorAuthUserId: string
  actorProfileId: string | null
}): Promise<SendRegistrationEmailResult | null> {
  if (!opts.enabled) return null
  try {
    return await sendRegistrationEmailByKey({
      registrationId: opts.registrationId,
      eventId: opts.eventId,
      templateKey: opts.templateKey,
      actorAuthUserId: opts.actorAuthUserId,
      actorProfileId: opts.actorProfileId,
    })
  } catch {
    return { ok: false, error: 'Gagal mengirim email.' }
  }
}
