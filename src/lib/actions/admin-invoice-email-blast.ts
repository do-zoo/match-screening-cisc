'use server'

import { InvoiceAdjustmentStatus, InvoiceAdjustmentType, RegistrationStatus } from '@prisma/client'

import { buildInvoiceBlastRegistrationWhere } from '@/lib/email/invoice-email-eligibility'
import type { EventRegistrantsTab } from '@/lib/admin/event-registrants-list-url'
import { guardEvent, isAuthError } from '@/lib/actions/guard'
import { prisma } from '@/lib/db/prisma'
import { sendInvoiceEmailForRegistration } from '@/lib/email/send-invoice-email'
import { loadClubNotificationPreferences } from '@/lib/public/load-club-notification-preferences'
import { resolveOutboundNotifyBehaviour } from '@/lib/notifications/notification-outbound-mode'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { requireAdminSession } from '@/lib/auth/session'

const EXCLUDED: RegistrationStatus[] = [
  RegistrationStatus.rejected,
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
]

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function previewInvoiceEmailBlast(
  eventId: string,
  opts: { respectListTab?: boolean; tab?: EventRegistrantsTab; q?: string },
): Promise<
  ActionResult<{
    eligible: number
    skippedNoEmail: number
    skippedNoAdjustment: number
    skippedStatus: number
  }>
> {
  try {
    await guardEvent(eventId)
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const eligible = await prisma.registration.count({
    where: buildInvoiceBlastRegistrationWhere(eventId, opts),
  })

  const withAdjustmentNoEmail = await prisma.registration.count({
    where: {
      eventId,
      contactEmail: null,
      status: { notIn: EXCLUDED },
      adjustments: {
        some: { type: InvoiceAdjustmentType.underpayment, status: InvoiceAdjustmentStatus.unpaid },
      },
    },
  })

  const skippedStatus = await prisma.registration.count({
    where: {
      eventId,
      status: { in: EXCLUDED },
      adjustments: {
        some: { type: InvoiceAdjustmentType.underpayment, status: InvoiceAdjustmentStatus.unpaid },
      },
    },
  })

  const totalWithUnpaid = await prisma.registration.count({
    where: {
      eventId,
      adjustments: {
        some: { type: InvoiceAdjustmentType.underpayment, status: InvoiceAdjustmentStatus.unpaid },
      },
    },
  })

  const skippedNoAdjustment = Math.max(0, totalWithUnpaid - eligible - withAdjustmentNoEmail - skippedStatus)

  return ok({
    eligible,
    skippedNoEmail: withAdjustmentNoEmail,
    skippedNoAdjustment,
    skippedStatus,
  })
}

export async function runInvoiceEmailBlast(
  eventId: string,
  opts: { respectListTab?: boolean; tab?: EventRegistrantsTab; q?: string },
): Promise<ActionResult<{ sent: number; failed: number; skipped: number }>> {
  let ctx
  try {
    ctx = await guardEvent(eventId)
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const session = await requireAdminSession()
  const prefs = await loadClubNotificationPreferences()
  const behaviour = resolveOutboundNotifyBehaviour(prefs.outboundMode)
  if (!behaviour.shouldLogToConsole && !behaviour.shouldAttemptProviderSend) {
    return rootError('Saluran email dimatikan di pengaturan notifikasi.')
  }

  const rows = await prisma.registration.findMany({
    where: buildInvoiceBlastRegistrationWhere(eventId, opts),
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  let sent = 0
  let failed = 0

  for (const row of rows) {
    const result = await sendInvoiceEmailForRegistration({
      registrationId: row.id,
      eventId,
      actorAuthUserId: session.user.id,
      actorProfileId: ctx.profileId,
    })
    if (result.ok) sent += 1
    else failed += 1
    await sleep(200)
  }

  const preview = await previewInvoiceEmailBlast(eventId, opts)
  const skipped =
    preview.ok ? preview.data.skippedNoEmail + preview.data.skippedNoAdjustment + preview.data.skippedStatus : 0

  return ok({ sent, failed, skipped })
}

export async function sendInvoiceEmailToRegistration(
  eventId: string,
  registrationId: string,
): Promise<ActionResult<{ sent: true }>> {
  let ctx
  try {
    ctx = await guardEvent(eventId)
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const session = await requireAdminSession()
  const result = await sendInvoiceEmailForRegistration({
    registrationId,
    eventId,
    actorAuthUserId: session.user.id,
    actorProfileId: ctx.profileId,
  })

  if (!result.ok) return rootError(result.error)
  return ok({ sent: true })
}
