'use server'

import { MemberValidation } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { eventRegistrationDetailPath } from '@/lib/admin/event-registrants-paths'
import { guardEvent, isAuthError } from '@/lib/actions/guard'
import { optionalStoredEmail, requiredStoredEmail } from '@/lib/email/normalize-email'
import { prisma } from '@/lib/db/prisma'
import { fieldError, ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { adminPrimaryRegistrantSchema } from '@/lib/forms/admin-primary-registrant-schema'
import { mergeTangselHolderContact } from '@/lib/members/merge-tangsel-holder-contact'
import { resolveMasterMemberRegistrationLookup } from '@/lib/members/resolve-master-member-registration-lookup'
import { zodToFieldErrors } from '@/lib/forms/zod'

function parseJsonPayload(formData: FormData): unknown | null {
  const raw = formData.get('payload')
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export async function updatePrimaryRegistrant(
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

  const parsed = adminPrimaryRegistrantSchema.safeParse(parseJsonPayload(formData))
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error))

  const registration = await prisma.registration.findFirst({
    where: { id: parsed.data.registrationId, eventId },
    select: {
      id: true,
      holders: {
        orderBy: { sortOrder: 'asc' as const },
        select: {
          id: true,
          sortOrder: true,
          memberType: true,
          claimedMemberNumber: true,
          memberValidation: true,
        },
      },
    },
  })
  if (!registration) return rootError('Registrasi tidak ditemukan.')

  const primaryHolder = registration.holders[0]
  if (!primaryHolder) return rootError('Data pemesan tidak ditemukan.')

  const memberType = primaryHolder.memberType
  const claimedTrimmed = parsed.data.claimedMemberNumber?.trim() ?? ''

  if (memberType === 'regional' && !claimedTrimmed) {
    return fieldError({ claimedMemberNumber: 'Nomor member wajib diisi untuk peserta regional.' })
  }

  if (memberType === 'tangsel' && !claimedTrimmed) {
    return fieldError({ claimedMemberNumber: 'Nomor member Tangsel wajib diisi.' })
  }

  let holderName = parsed.data.holderName.trim()
  let holderWhatsapp = parsed.data.holderWhatsapp.trim()
  let holderEmail: string
  try {
    holderEmail = requiredStoredEmail(parsed.data.holderEmail)
  } catch {
    return fieldError({ holderEmail: 'Format email tidak valid.' })
  }

  let claimedMemberNumber: string | null = claimedTrimmed || null
  let memberValidation = primaryHolder.memberValidation

  if (memberType === 'tangsel' && claimedTrimmed) {
    const lookup = await resolveMasterMemberRegistrationLookup(claimedTrimmed, eventId, {
      excludeRegistrationId: registration.id,
    })
    if (lookup.status === 'not_found') {
      return fieldError({ claimedMemberNumber: 'Nomor member tidak ditemukan di direktori Tangsel.' })
    }
    if (lookup.status === 'already_registered') {
      return fieldError({ claimedMemberNumber: 'Nomor member sudah dipakai pada registrasi aktif acara ini.' })
    }
    const merged = mergeTangselHolderContact(
      {
        holderName,
        holderWhatsapp,
        holderEmail,
        claimedMemberNumber: claimedTrimmed,
        memberType: 'tangsel',
      },
      lookup,
    )
    holderName = merged.holderName.trim()
    holderWhatsapp = merged.holderWhatsapp?.trim() ?? ''
    holderEmail = requiredStoredEmail((merged.holderEmail ?? holderEmail).trim())
    claimedMemberNumber = claimedTrimmed
  }

  const priorClaimed = primaryHolder.claimedMemberNumber?.trim() ?? ''
  if (memberType && claimedMemberNumber !== priorClaimed) {
    memberValidation = MemberValidation.unknown
  }

  try {
    await prisma.$transaction(async tx => {
      await tx.registrationHolder.update({
        where: { id: primaryHolder.id },
        data: {
          holderName,
          holderWhatsapp,
          holderEmail: optionalStoredEmail(holderEmail),
          claimedMemberNumber,
          memberValidation,
        },
      })
      await tx.registration.update({
        where: { id: registration.id },
        data: {
          contactName: holderName,
          contactWhatsapp: holderWhatsapp,
          contactEmail: holderEmail,
        },
      })
    })
  } catch (e) {
    console.error('[updatePrimaryRegistrant]', e)
    return rootError('Gagal menyimpan data pemesan.')
  }

  revalidatePath(eventRegistrationDetailPath(eventId, registration.id))
  return ok({ registrationId: registration.id })
}
