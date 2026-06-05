'use server'

import { guardEvent, isAuthError } from '@/lib/actions/guard'
import { sendRegistrationApprovedEmailForRegistration } from '@/lib/email/send-registration-approved-email'
import { requireAdminSession } from '@/lib/auth/session'
import { getAdminContext } from '@/lib/auth/admin-context'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'

export async function sendRegistrationApprovedEmailToRegistration(
  eventId: string,
  registrationId: string,
): Promise<ActionResult<{ sent: true; dryRun?: boolean }>> {
  let profileId: string | null = null
  try {
    await guardEvent(eventId)
    const session = await requireAdminSession()
    const ctx = await getAdminContext(session.user.id)
    profileId = ctx?.profileId ?? null
    const result = await sendRegistrationApprovedEmailForRegistration({
      registrationId,
      eventId,
      actorAuthUserId: session.user.id,
      actorProfileId: profileId,
    })

    if (!result.ok) return rootError(result.error)
    if (result.skipped === 'no_email') {
      return rootError('Email kontak belum diisi.')
    }
    if (result.skipped === 'wrong_status') {
      return rootError('Pendaftaran belum disetujui.')
    }
    return ok({ sent: true, dryRun: result.dryRun })
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }
}
