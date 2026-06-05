'use server'

import { revalidatePath } from 'next/cache'

import { appendClubAuditLog } from '@/lib/audit/append-club-audit-log'
import { CLUB_AUDIT_ACTION } from '@/lib/audit/club-audit-actions'
import { guardOwner, isAuthError, type OwnerGuardContext } from '@/lib/actions/guard'
import { prisma } from '@/lib/db/prisma'
import { CLUB_EMAIL_DEFAULT_BODIES } from '@/lib/email-templates/default-bodies'
import { validateEmailTemplate } from '@/lib/email-templates/email-template-policy'
import { saveClubEmailTemplateFormSchema } from '@/lib/forms/club-email-template-schema'
import { fieldError, ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { zodToFieldErrors } from '@/lib/forms/zod'

export async function saveClubEmailTemplate(
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

  const parsed = saveClubEmailTemplateFormSchema.safeParse({
    key: formData.get('key'),
    subject: typeof formData.get('subject') === 'string' ? formData.get('subject') : '',
    body: typeof formData.get('body') === 'string' ? formData.get('body') : '',
  })

  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error))
  }

  const { key, subject, body } = parsed.data
  const policyErr = validateEmailTemplate(key, subject, body)
  if (policyErr) return fieldError({ body: policyErr })

  try {
    await prisma.clubEmailTemplate.upsert({
      where: { key },
      create: { key, subject: subject.trim(), body },
      update: { subject: subject.trim(), body },
    })
  } catch {
    return rootError('Gagal menyimpan templat email.')
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: owner.profileId,
    actorAuthUserId: owner.authUserId,
    action: CLUB_AUDIT_ACTION.CLUB_EMAIL_TEMPLATE_SAVED,
    targetType: 'club_email_template',
    targetId: key,
  })

  revalidatePath('/admin/settings/templates/email')
  return ok({ saved: true })
}

export async function resetClubEmailTemplate(
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

  const keyRaw = formData.get('key')
  const keyParsed = saveClubEmailTemplateFormSchema.shape.key.safeParse(keyRaw)
  if (!keyParsed.success) return fieldError({ key: 'Jenis templat tidak valid.' })

  const key = keyParsed.data
  const defaults = CLUB_EMAIL_DEFAULT_BODIES[key]

  try {
    await prisma.clubEmailTemplate.upsert({
      where: { key },
      create: { key, subject: defaults.subject, body: defaults.body },
      update: { subject: defaults.subject, body: defaults.body },
    })
  } catch {
    return rootError('Gagal mengembalikan templat email.')
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: owner.profileId,
    actorAuthUserId: owner.authUserId,
    action: CLUB_AUDIT_ACTION.CLUB_EMAIL_TEMPLATE_RESET,
    targetType: 'club_email_template',
    targetId: key,
  })

  revalidatePath('/admin/settings/templates/email')
  return ok({ saved: true })
}
