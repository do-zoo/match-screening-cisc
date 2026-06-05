'use server'

import { revalidatePath } from 'next/cache'

import { appendClubAuditLog } from '@/lib/audit/append-club-audit-log'
import { CLUB_AUDIT_ACTION } from '@/lib/audit/club-audit-actions'
import { guardOwner, isAuthError, type OwnerGuardContext } from '@/lib/actions/guard'
import { prisma } from '@/lib/db/prisma'
import { clubNotificationPreferencesSaveSchema } from '@/lib/forms/club-notification-preferences-schema'
import { fieldError, ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { zodToFieldErrors } from '@/lib/forms/zod'
import { CLUB_NOTIFICATION_PREFS_KEY } from '@/lib/public/load-club-notification-preferences'

export async function saveClubNotificationPreferences(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  let owner: OwnerGuardContext
  try {
    owner = await guardOwner()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const parsed = clubNotificationPreferencesSaveSchema.safeParse({
    outboundMode: formData.get('outboundMode'),
    outboundLabel: formData.get('outboundLabel'),
    emailAutoOnSubmitReceipt: formData.get('emailAutoOnSubmitReceipt'),
    emailAutoOnApprove: formData.get('emailAutoOnApprove'),
    emailAutoOnReject: formData.get('emailAutoOnReject'),
    emailAutoOnPaymentIssue: formData.get('emailAutoOnPaymentIssue'),
    emailAutoOnCancel: formData.get('emailAutoOnCancel'),
    emailAutoOnRefund: formData.get('emailAutoOnRefund'),
  })

  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error))

  try {
    await prisma.clubNotificationPreferences.upsert({
      where: { singletonKey: CLUB_NOTIFICATION_PREFS_KEY },
      create: {
        singletonKey: CLUB_NOTIFICATION_PREFS_KEY,
        outboundMode: parsed.data.outboundMode,
        outboundLabel: parsed.data.outboundLabel === '' ? null : parsed.data.outboundLabel,
        emailAutoOnSubmitReceipt: parsed.data.emailAutoOnSubmitReceipt,
        emailAutoOnApprove: parsed.data.emailAutoOnApprove,
        emailAutoOnReject: parsed.data.emailAutoOnReject,
        emailAutoOnPaymentIssue: parsed.data.emailAutoOnPaymentIssue,
        emailAutoOnCancel: parsed.data.emailAutoOnCancel,
        emailAutoOnRefund: parsed.data.emailAutoOnRefund,
      },
      update: {
        outboundMode: parsed.data.outboundMode,
        outboundLabel: parsed.data.outboundLabel === '' ? null : parsed.data.outboundLabel,
        emailAutoOnSubmitReceipt: parsed.data.emailAutoOnSubmitReceipt,
        emailAutoOnApprove: parsed.data.emailAutoOnApprove,
        emailAutoOnReject: parsed.data.emailAutoOnReject,
        emailAutoOnPaymentIssue: parsed.data.emailAutoOnPaymentIssue,
        emailAutoOnCancel: parsed.data.emailAutoOnCancel,
        emailAutoOnRefund: parsed.data.emailAutoOnRefund,
      },
    })
  } catch {
    return rootError('Gagal menyimpan preferensi.')
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: owner.profileId,
    actorAuthUserId: owner.authUserId,
    action: CLUB_AUDIT_ACTION.NOTIFICATION_PREFS_SAVED,
    targetType: 'club_notification_preferences',
    targetId: CLUB_NOTIFICATION_PREFS_KEY,
    metadata: {
      outboundMode: parsed.data.outboundMode,
      outboundLabelSet: parsed.data.outboundLabel !== '',
      emailAutoOnSubmitReceipt: parsed.data.emailAutoOnSubmitReceipt,
      emailAutoOnApprove: parsed.data.emailAutoOnApprove,
      emailAutoOnReject: parsed.data.emailAutoOnReject,
      emailAutoOnPaymentIssue: parsed.data.emailAutoOnPaymentIssue,
      emailAutoOnCancel: parsed.data.emailAutoOnCancel,
      emailAutoOnRefund: parsed.data.emailAutoOnRefund,
    },
  })

  revalidatePath('/admin/settings/notifications')
  return ok({ saved: true })
}
