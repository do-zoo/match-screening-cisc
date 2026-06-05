'use server'

import { revalidatePath } from 'next/cache'
import { EmailTemplateKey, RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { guardEvent, isAuthError } from '@/lib/actions/guard'
import { eventRegistrationDetailPath, eventRegistrantsListPath } from '@/lib/admin/event-registrants-paths'
import { maybeAutoSendRegistrationEmail, type SendRegistrationEmailResult } from '@/lib/email/send-registration-email'
import { loadClubNotificationPreferences } from '@/lib/public/load-club-notification-preferences'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { requireAdminSession } from '@/lib/auth/session'

type CancelRefundData = { ok: true; email: SendRegistrationEmailResult | null }

const CANCEL_BLOCKED_FROM: RegistrationStatus[] = [
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
  RegistrationStatus.rejected,
]

const REFUND_ALLOWED_FROM: RegistrationStatus[] = [RegistrationStatus.approved, RegistrationStatus.cancelled]

export async function cancelRegistration(
  eventId: string,
  registrationId: string,
): Promise<ActionResult<CancelRefundData>> {
  let ctx
  try {
    ctx = await guardEvent(eventId)
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const existing = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { status: true, eventId: true },
  })

  if (!existing || existing.eventId !== eventId) {
    return rootError('Pendaftaran tidak ditemukan.')
  }
  if (CANCEL_BLOCKED_FROM.includes(existing.status)) {
    return rootError(`Tidak dapat membatalkan pendaftaran dengan status "${existing.status}".`)
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: RegistrationStatus.cancelled },
  })

  revalidatePath(eventRegistrantsListPath(eventId))
  revalidatePath(eventRegistrationDetailPath(eventId, registrationId))

  const session = await requireAdminSession()
  const prefs = await loadClubNotificationPreferences()
  const email = await maybeAutoSendRegistrationEmail({
    registrationId,
    eventId,
    templateKey: EmailTemplateKey.cancelled,
    enabled: prefs.emailAutoOnCancel,
    actorAuthUserId: session.user.id,
    actorProfileId: ctx.profileId,
  })

  return ok({ ok: true, email })
}

export async function refundRegistration(
  eventId: string,
  registrationId: string,
): Promise<ActionResult<CancelRefundData>> {
  let ctx
  try {
    ctx = await guardEvent(eventId)
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const existing = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { status: true, eventId: true },
  })

  if (!existing || existing.eventId !== eventId) {
    return rootError('Pendaftaran tidak ditemukan.')
  }
  if (!REFUND_ALLOWED_FROM.includes(existing.status)) {
    return rootError(`Refund hanya untuk pendaftaran dengan status "approved" atau "cancelled".`)
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: RegistrationStatus.refunded },
  })

  revalidatePath(eventRegistrantsListPath(eventId))
  revalidatePath(eventRegistrationDetailPath(eventId, registrationId))

  const session = await requireAdminSession()
  const prefs = await loadClubNotificationPreferences()
  const email = await maybeAutoSendRegistrationEmail({
    registrationId,
    eventId,
    templateKey: EmailTemplateKey.refunded,
    enabled: prefs.emailAutoOnRefund,
    actorAuthUserId: session.user.id,
    actorProfileId: ctx.profileId,
  })

  return ok({ ok: true, email })
}
