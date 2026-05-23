'use server'

import { RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { submitRegistrationSchema } from '@/lib/forms/submit-registration-schema'
import { computeSubmitTotal } from '@/lib/pricing/compute-submit-total'
import {
  assertRegistrationAcceptableOrThrowForTx,
  countRegistrationsTowardQuota,
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
  RegistrationNotAcceptableError,
} from '@/lib/events/registration-window'
import {
  DEFAULT_GLOBAL_REGISTRATION_CLOSED,
  mergeGlobalRegistrationClosure,
} from '@/lib/public/club-operational-policy'
import { loadClubOperationalSettings } from '@/lib/public/load-club-operational-settings'

export type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'

export async function submitRegistration(
  eventId: string,
  formData: FormData,
): Promise<ActionResult<{ registrationId: string }>> {
  // 1. Parse holders from JSON
  let holdersRaw: unknown
  try {
    holdersRaw = JSON.parse(formData.get('holders') as string)
  } catch {
    return rootError('Data peserta tidak valid.')
  }

  const rawInput = {
    ticketCategoryId: formData.get('ticketCategoryId'),
    ticketQty: Number(formData.get('ticketQty')),
    holders: holdersRaw,
    contactWhatsapp: formData.get('contactWhatsapp'),
  }

  const parsed = submitRegistrationSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return rootError(firstIssue?.message ?? 'Data tidak valid.')
  }

  const input = parsed.data

  // 2. Fetch event + category + club settings in parallel
  const [event, opsGate] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        registrationManualClosed: true,
        openRegistrationAt: true,
        closeRegistrationAt: true,
        registrationCapacity: true,
        ticketCategories: {
          where: { id: input.ticketCategoryId, isActive: true },
          select: {
            id: true,
            regularPrice: true,
            memberPrice: true,
            maxQtyPerPerson: true,
          },
        },
      },
    }),
    loadClubOperationalSettings(),
  ])

  if (!event) return rootError('Acara tidak ditemukan.')

  // 3. Check registration window (local + global)
  const registrationsTowardQuotaPreview = await countRegistrationsTowardQuota(prisma, event.id)
  const locallyOpen = isRegistrationOpenForEvent({
    event,
    registrationsTowardQuota: registrationsTowardQuotaPreview,
  })
  const mergedGate = mergeGlobalRegistrationClosure({
    registrationOpen: locallyOpen,
    registrationClosedMessage: locallyOpen
      ? null
      : registrationBlockMessageForPublic({
          eventStatus: event.status,
          registrationManualClosed: event.registrationManualClosed,
          registrationCapacity: event.registrationCapacity,
          registrationsTowardQuota: registrationsTowardQuotaPreview,
          openRegistrationAt: event.openRegistrationAt,
          closeRegistrationAt: event.closeRegistrationAt,
        }),
    registrationGloballyDisabled: opsGate.registrationGloballyDisabled,
    globalRegistrationClosedMessage: opsGate.globalRegistrationClosedMessage,
  })
  if (!mergedGate.registrationOpen) {
    return rootError(mergedGate.registrationClosedMessage ?? DEFAULT_GLOBAL_REGISTRATION_CLOSED)
  }

  // 4. Validate category
  const category = event.ticketCategories[0]
  if (!category) return rootError('Kategori tiket tidak tersedia.')

  if (category.maxQtyPerPerson !== null && input.ticketQty > category.maxQtyPerPerson) {
    return rootError(`Maksimal ${category.maxQtyPerPerson} tiket untuk kategori ini.`)
  }

  if (input.holders.length !== input.ticketQty) {
    return rootError('Jumlah data peserta tidak sesuai dengan jumlah tiket.')
  }

  // 5. Compute pricing (server always uses 'unknown' — admin verifies member status)
  const pricing = computeSubmitTotal({
    holders: input.holders.map(h => ({
      memberValidation: 'unknown' as const,
      category: {
        regularPrice: category.regularPrice,
        memberPrice: category.memberPrice,
      },
      menuItem: h.mandatoryMenuItemId ? { price: 0, name: '' } : null,
    })),
  })

  // 6. Create Registration + RegistrationHolder[] in a transaction
  try {
    const reg = await prisma.$transaction(async tx => {
      await assertRegistrationAcceptableOrThrowForTx(tx, event)

      const contactName = input.holders[0].holderName

      return tx.registration.create({
        data: {
          eventId: event.id,
          ticketCategoryId: input.ticketCategoryId,
          ticketQty: input.ticketQty,
          contactName,
          contactWhatsapp: input.contactWhatsapp,
          computedTotalAtSubmit: pricing.grandTotal,
          status: RegistrationStatus.submitted,
          holders: {
            create: input.holders.map((h, i) => ({
              sortOrder: i + 1,
              holderName: h.holderName,
              holderWhatsapp: h.holderWhatsapp?.trim() || null,
              claimedMemberNumber: h.claimedMemberNumber?.trim() || null,
              ticketPriceApplied: pricing.lines[i]!.ticketPrice,
              mandatoryMenuItemId: h.mandatoryMenuItemId?.trim() || null,
              mandatoryMenuPriceApplied: null,
            })),
          },
        },
      })
    })

    return ok({ registrationId: reg.id })
  } catch (e) {
    if (e instanceof RegistrationNotAcceptableError) {
      return rootError(e.message)
    }
    console.error(e)
    return rootError('Gagal menyimpan pendaftaran. Coba lagi.')
  }
}
