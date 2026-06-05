'use server'

import { HolderDataMode, MemberType, RegistrationStatus } from '@prisma/client'
import { lookupMemberForRegistration } from '@/lib/actions/lookup-member-for-registration'
import { assertHolderEligibleForMemberAccessMode } from '@/lib/events/member-access-mode'
import { optionalStoredEmail, requiredStoredEmail } from '@/lib/email/normalize-email'
import { prisma } from '@/lib/db/prisma'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import {
  isTangselDirectoryHolder,
  submitRegistrationSchema,
  whatsappPhoneSchema,
} from '@/lib/forms/submit-registration-schema'
import { mergeTangselHolderContact } from '@/lib/members/merge-tangsel-holder-contact'
import { resolveMasterMemberRegistrationLookup } from '@/lib/members/resolve-master-member-registration-lookup'
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
import { trySendReceiptEmailAfterSubmit } from '@/lib/email/send-registration-email'
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
        memberAccessMode: true,
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

  const holdersToValidate = event.requireAllHolderData ? input.holders : [input.holders[0]!]
  for (const h of holdersToValidate) {
    let tangselValid = false
    if (
      event.memberAccessMode === 'tangsel_only' &&
      h.memberType === 'tangsel' &&
      h.claimedMemberNumber?.trim()
    ) {
      const lookup = await lookupMemberForRegistration(h.claimedMemberNumber, eventId)
      tangselValid = lookup.status === 'valid'
    }
    const eligibility = assertHolderEligibleForMemberAccessMode(h, event.memberAccessMode, tangselValid)
    if (!eligibility.ok) return rootError(eligibility.message)
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

  const mergedHolders = [...holdersForProcessing]
  for (let i = 0; i < mergedHolders.length; i++) {
    const h = mergedHolders[i]!
    if (!isTangselDirectoryHolder(h)) continue
    const lookup = await resolveMasterMemberRegistrationLookup(h.claimedMemberNumber!, eventId)
    if (lookup.status !== 'valid') {
      return rootError('Nomor member CISC Tangsel tidak valid.')
    }
    mergedHolders[i] = mergeTangselHolderContact(h, lookup)
  }

  const primaryMerged = mergedHolders[0]
  if (primaryMerged) {
    const mergedEmail = (primaryMerged.holderEmail ?? '').trim()
    if (!mergedEmail) {
      return rootError('Email kontak wajib diisi')
    }
    const waResult = whatsappPhoneSchema.safeParse(primaryMerged.holderWhatsapp ?? '')
    if (!waResult.success) {
      return rootError(waResult.error.issues[0]?.message ?? 'Nomor WhatsApp tidak valid')
    }
  }

  // 6. Compute pricing (server always uses 'unknown' — admin verifies member status)
  const pricing = computeSubmitTotal({
    holders: mergedHolders.map(h => ({
      memberValidation: 'unknown' as const,
      category: {
        regularPrice: category.regularPrice,
        memberPrice: category.memberPrice,
      },
      menuItem: h.mandatoryMenuItemId ? { price: 0, name: '' } : null,
    })),
  })

  const holderDataMode: HolderDataMode = event.requireAllHolderData
    ? HolderDataMode.all_holders
    : HolderDataMode.primary_only

  // 7. Create Registration + holders + tickets in a transaction
  let reg: { id: string; holders: { id: string; sortOrder: number }[] }
  try {
    reg = await prisma.$transaction(async tx => {
      await assertRegistrationAcceptableOrThrowForTx(tx, event)
      await assertCategoryCapacityOrThrowForTx(tx, category)

      const contactName = mergedHolders[0]!.holderName
      const contactWhatsapp = mergedHolders[0]!.holderWhatsapp ?? ''
      const contactEmail = requiredStoredEmail((mergedHolders[0]!.holderEmail ?? '').trim())

      const ticketCreates = mergedHolders.map((h, i) => ({
        sortOrder: i + 1,
        ticketPriceApplied: pricing.lines[i]!.ticketPrice,
        mandatoryMenuItemId: h.mandatoryMenuItemId?.trim() || null,
        mandatoryMenuPriceApplied: null,
      }))

      const registrationBase = {
        eventId: event.id,
        ticketCategoryId: input.ticketCategoryId,
        ticketQty: input.ticketQty,
        holderDataMode,
        contactName,
        contactWhatsapp,
        contactEmail,
        computedTotalAtSubmit: pricing.grandTotal,
        status: RegistrationStatus.submitted,
      }

      const holderRows = event.requireAllHolderData
        ? mergedHolders.map((h, i) => ({
            sortOrder: i + 1,
            holderName: h.holderName,
            holderWhatsapp: h.holderWhatsapp?.trim() || null,
            holderEmail: optionalStoredEmail(h.holderEmail),
            claimedMemberNumber: h.claimedMemberNumber?.trim() || null,
            memberType: h.memberType ? (h.memberType as MemberType) : null,
          }))
        : (() => {
            const primary = mergedHolders[0]!
            return [
              {
                sortOrder: 1,
                holderName: primary.holderName,
                holderWhatsapp: primary.holderWhatsapp?.trim() || null,
                holderEmail: optionalStoredEmail(primary.holderEmail),
                claimedMemberNumber: primary.claimedMemberNumber?.trim() || null,
                memberType: primary.memberType ? (primary.memberType as MemberType) : null,
              },
            ]
          })()

      const reg = await tx.registration.create({
        data: {
          ...registrationBase,
          holders: { create: holderRows },
        },
        include: {
          holders: {
            select: { id: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      })

      const ticketRows = event.requireAllHolderData
        ? reg.holders.map((holder, i) => ({
            registrationId: reg.id,
            assignedHolderId: holder.id,
            ...ticketCreates[i]!,
          }))
        : ticketCreates.map(t => ({
            registrationId: reg.id,
            assignedHolderId: reg.holders[0]!.id,
            ...t,
          }))

      await tx.registrationTicket.createMany({ data: ticketRows })
      return reg
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

  void trySendReceiptEmailAfterSubmit({ registrationId: reg.id, eventId }).catch(e => {
    console.error('[submitRegistration] receipt email failed', e)
  })

  return ok({ registrationId: reg.id })
}
