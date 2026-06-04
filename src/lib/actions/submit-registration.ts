'use server'

import { MemberType, RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { submitRegistrationSchema } from '@/lib/forms/submit-registration-schema'
import { computeSubmitTotal } from '@/lib/pricing/compute-submit-total'
import {
  assertRegistrationAcceptableOrThrowForTx,
  assertCategoryCapacityOrThrowForTx,
  countCategoryRegistrationsTowardQuota,
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
  RegistrationNotAcceptableError,
} from '@/lib/events/registration-window'
import {
  DEFAULT_GLOBAL_REGISTRATION_CLOSED,
  mergeGlobalRegistrationClosure,
} from '@/lib/public/club-operational-policy'
import { loadClubOperationalSettings } from '@/lib/public/load-club-operational-settings'
import { uploadImageForRegistration } from '@/lib/uploads/upload-image'

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
  }

  const parsed = submitRegistrationSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return rootError(firstIssue?.message ?? 'Data tidak valid.')
  }

  const input = parsed.data

  // 2. Collect and validate regional member card files
  const regionalFiles = new Map<number, File>()
  for (let i = 0; i < input.holders.length; i++) {
    if (input.holders[i]?.memberType !== 'regional') continue
    const raw = formData.get(`memberCardPhoto_${i}`)
    if (!(raw instanceof File) || raw.size === 0) {
      return rootError('Bukti kartu member wajib diupload untuk peserta Member CISC Regional.')
    }
    regionalFiles.set(i, raw)
  }

  // 3. Fetch event + category + club settings in parallel
  const [event, opsGate] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        registrationManualClosed: true,
        openRegistrationAt: true,
        closeRegistrationAt: true,
        requireAllHolderData: true,
        ticketCategories: {
          where: { id: input.ticketCategoryId, isActive: true },
          select: {
            id: true,
            regularPrice: true,
            memberPrice: true,
            maxQtyPerPerson: true,
            capacity: true,
          },
        },
      },
    }),
    loadClubOperationalSettings(),
  ])

  if (!event) return rootError('Acara tidak ditemukan.')

  // 4. Check registration window (local + global)
  const locallyOpen = isRegistrationOpenForEvent({ event })
  const mergedGate = mergeGlobalRegistrationClosure({
    registrationOpen: locallyOpen,
    registrationClosedMessage: locallyOpen
      ? null
      : registrationBlockMessageForPublic({
          eventStatus: event.status,
          registrationManualClosed: event.registrationManualClosed,
          openRegistrationAt: event.openRegistrationAt,
          closeRegistrationAt: event.closeRegistrationAt,
        }),
    registrationGloballyDisabled: opsGate.registrationGloballyDisabled,
    globalRegistrationClosedMessage: opsGate.globalRegistrationClosedMessage,
  })
  if (!mergedGate.registrationOpen) {
    return rootError(mergedGate.registrationClosedMessage ?? DEFAULT_GLOBAL_REGISTRATION_CLOSED)
  }

  // 5. Validate category
  const category = event.ticketCategories[0]
  if (!category) return rootError('Kategori tiket tidak tersedia.')

  if (category.maxQtyPerPerson !== null && input.ticketQty > category.maxQtyPerPerson) {
    return rootError(`Maksimal ${category.maxQtyPerPerson} tiket untuk kategori ini.`)
  }

  // 5a. Pre-check per-category capacity (optimistic, re-checked inside tx)
  if (category.capacity != null && category.capacity > 0) {
    const catCount = await countCategoryRegistrationsTowardQuota(prisma, category.id)
    if (catCount >= category.capacity) {
      return rootError('Kuota kategori tiket ini sudah habis.')
    }
  }

  if (event.requireAllHolderData) {
    if (input.holders.length !== input.ticketQty) {
      return rootError('Jumlah data peserta tidak sesuai dengan jumlah tiket.')
    }
  } else {
    if (input.holders.length !== 1) {
      return rootError('Jumlah data peserta tidak valid.')
    }
  }

  const holdersForProcessing = event.requireAllHolderData
    ? input.holders
    : Array.from({ length: input.ticketQty }, (_, i) => {
        const base = { ...input.holders[0]! }
        // Clones beyond the primary are synthetic — they represent the same person
        // and should not carry a separate member claim requiring proof upload.
        if (i > 0) base.memberType = undefined
        return base
      })

  // 6. Compute pricing (server always uses 'unknown' — admin verifies member status)
  const pricing = computeSubmitTotal({
    holders: holdersForProcessing.map(h => ({
      memberValidation: 'unknown' as const,
      category: {
        regularPrice: category.regularPrice,
        memberPrice: category.memberPrice,
      },
      menuItem: h.mandatoryMenuItemId ? { price: 0, name: '' } : null,
    })),
  })

  // 7. Create Registration + RegistrationHolder[] in a transaction
  let reg: { id: string; holders: { id: string; sortOrder: number }[] }
  try {
    reg = await prisma.$transaction(async tx => {
      await assertRegistrationAcceptableOrThrowForTx(tx, event)
      await assertCategoryCapacityOrThrowForTx(tx, category)

      const contactName = input.holders[0].holderName
      const contactWhatsapp = input.holders[0].holderWhatsapp ?? ''

      return tx.registration.create({
        data: {
          eventId: event.id,
          ticketCategoryId: input.ticketCategoryId,
          ticketQty: input.ticketQty,
          contactName,
          contactWhatsapp,
          computedTotalAtSubmit: pricing.grandTotal,
          status: RegistrationStatus.submitted,
          holders: {
            create: holdersForProcessing.map((h, i) => ({
              sortOrder: i + 1,
              holderName: h.holderName,
              holderWhatsapp: h.holderWhatsapp?.trim() || null,
              claimedMemberNumber: h.claimedMemberNumber?.trim() || null,
              memberType: h.memberType ? (h.memberType as MemberType) : null,
              ticketPriceApplied: pricing.lines[i]!.ticketPrice,
              mandatoryMenuItemId: h.mandatoryMenuItemId?.trim() || null,
              mandatoryMenuPriceApplied: null,
            })),
          },
        },
        include: {
          holders: {
            select: { id: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      })
    })
  } catch (e) {
    if (e instanceof RegistrationNotAcceptableError) {
      return rootError(e.message)
    }
    console.error(e)
    return rootError('Gagal menyimpan pendaftaran. Coba lagi.')
  }

  // 8. Upload member card photos for regional holders (non-fatal)
  for (const [inputIndex, file] of regionalFiles) {
    const holderRow = reg.holders[inputIndex]
    if (!holderRow) continue
    try {
      await uploadImageForRegistration({
        purpose: 'member_card_photo',
        registrationId: reg.id,
        registrationHolderId: holderRow.id,
        file,
      })
    } catch (e) {
      console.error(`[submitRegistration] Failed to upload member card photo for holder index ${inputIndex}:`, e)
    }
  }

  return ok({ registrationId: reg.id })
}
