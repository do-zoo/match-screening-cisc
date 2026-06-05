'use server'

import {
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
  RegistrationStatus,
} from '@prisma/client'

import { guardEvent, isAuthError } from '@/lib/actions/guard'
import type { EventRegistrantsTab } from '@/lib/admin/event-registrants-list-url'
import { buildRegistrationInvoiceBlastWhere } from '@/lib/email/registration-email-eligibility'
import { sendRegistrationInvoiceEmailForRegistration } from '@/lib/email/send-registration-invoice-email'
import { prisma } from '@/lib/db/prisma'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { requireAdminSession } from '@/lib/auth/session'
import { loadClubNotificationPreferences } from '@/lib/public/load-club-notification-preferences'
import { resolveOutboundNotifyBehaviour } from '@/lib/notifications/notification-outbound-mode'

const EXCLUDED: RegistrationStatus[] = [
  RegistrationStatus.rejected,
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
]

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function previewRegistrationInvoiceEmailBlast(
  eventId: string,
  opts: { respectListTab?: boolean; tab?: EventRegistrantsTab; q?: string },
): Promise<
  ActionResult<{
    eligible: number
    skippedNoEmail: number
    skippedHasUnderpayment: number
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
    where: buildRegistrationInvoiceBlastWhere(eventId, opts),
  })

  const withUnderpayment = await prisma.registration.count({
    where: {
      eventId,
      contactEmail: { not: null },
      status: { notIn: EXCLUDED },
      adjustments: {
        some: {
          type: InvoiceAdjustmentType.underpayment,
          status: InvoiceAdjustmentStatus.unpaid,
        },
      },
    },
  })

  const noEmail = await prisma.registration.count({
    where: {
      eventId,
      contactEmail: null,
      status: { notIn: EXCLUDED },
    },
  })

  const skippedStatus = await prisma.registration.count({
    where: { eventId, status: { in: EXCLUDED } },
  })

  const skippedHasUnderpayment = Math.max(0, withUnderpayment)
  const skippedNoEmail = Math.max(0, noEmail)

  return ok({
    eligible,
    skippedNoEmail,
    skippedHasUnderpayment,
    skippedStatus,
  })
}

export async function runRegistrationInvoiceEmailBlast(
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
    where: buildRegistrationInvoiceBlastWhere(eventId, opts),
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  let sent = 0
  let failed = 0

  for (const row of rows) {
    const result = await sendRegistrationInvoiceEmailForRegistration({
      registrationId: row.id,
      eventId,
      actorAuthUserId: session.user.id,
      actorProfileId: ctx.profileId,
    })
    if (result.ok) sent += 1
    else failed += 1
    await sleep(200)
  }

  const preview = await previewRegistrationInvoiceEmailBlast(eventId, opts)
  const skipped = preview.ok
    ? preview.data.skippedNoEmail + preview.data.skippedHasUnderpayment + preview.data.skippedStatus
    : 0

  return ok({ sent, failed, skipped })
}

export async function sendRegistrationInvoiceEmailToRegistration(
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
  const result = await sendRegistrationInvoiceEmailForRegistration({
    registrationId,
    eventId,
    actorAuthUserId: session.user.id,
    actorProfileId: ctx.profileId,
  })

  if (!result.ok) return rootError(result.error)
  return ok({ sent: true })
}
