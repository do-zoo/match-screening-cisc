'use server'

import { revalidatePath } from 'next/cache'

import { eventRegistrationDetailPath } from '@/lib/admin/event-registrants-paths'
import { guardEvent, isAuthError } from '@/lib/actions/guard'
import { optionalStoredEmail, requiredStoredEmail } from '@/lib/email/normalize-email'
import { prisma } from '@/lib/db/prisma'
import { fieldError, ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { zodToFieldErrors } from '@/lib/forms/zod'
import { adminRegistrationContactSchema } from '@/lib/forms/admin-registration-contact-schema'

function parseJsonPayload(formData: FormData): unknown | null {
  const raw = formData.get('payload')
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export async function updateRegistrationContactEmails(
  eventId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ registrationId: string }>> {
  try {
    await guardEvent(eventId)
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const parsed = adminRegistrationContactSchema.safeParse(parseJsonPayload(formData))
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error))

  const registration = await prisma.registration.findFirst({
    where: { id: parsed.data.registrationId, eventId },
    select: { id: true, holders: { select: { id: true } } },
  })
  if (!registration) return rootError('Registrasi tidak ditemukan.')

  const holderIds = new Set(registration.holders.map(h => h.id))
  for (const row of parsed.data.holders) {
    if (!holderIds.has(row.id)) return rootError('Data pemegang tiket tidak valid.')
  }

  let contactEmail: string
  try {
    contactEmail = requiredStoredEmail(parsed.data.contactEmail)
  } catch {
    return fieldError({ contactEmail: 'Format email tidak valid.' })
  }

  try {
    await prisma.$transaction(async tx => {
      await tx.registration.update({
        where: { id: registration.id },
        data: { contactEmail },
      })
      for (const row of parsed.data.holders) {
        await tx.registrationHolder.update({
          where: { id: row.id },
          data: { holderEmail: optionalStoredEmail(row.holderEmail) },
        })
      }
    })
  } catch (e) {
    console.error('[updateRegistrationContactEmails]', e)
    return rootError('Gagal menyimpan email.')
  }

  revalidatePath(eventRegistrationDetailPath(eventId, registration.id))
  return ok({ registrationId: registration.id })
}
