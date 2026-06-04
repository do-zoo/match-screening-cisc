'use server'

import { randomUUID } from 'node:crypto'

import { AdminRole } from '@prisma/client'
import { del } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { guardOwner, guardOwnerOrAdmin, isAuthError, type OwnerGuardContext } from '@/lib/actions/guard'
import { ADMIN_EVENTS_DELETE_SUCCESS_FLASH } from '@/lib/admin/admin-events-delete-flash'
import { eventRegistrantsListPath } from '@/lib/admin/event-registrants-paths'
import { appendClubAuditLog } from '@/lib/audit/append-club-audit-log'
import { CLUB_AUDIT_ACTION } from '@/lib/audit/club-audit-actions'
import { prisma } from '@/lib/db/prisma'
import {
  findLockedViolations,
  findMandatoryMenuLockedViolation,
  needsSensitiveAcknowledgement,
  type EventIntegritySnapshot,
} from '@/lib/events/event-edit-guards'
import { allocateUniqueEventSlug } from '@/lib/events/generate-event-slug'
import { fieldError, ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { adminEventUpsertSchema, type AdminEventUpsertInput } from '@/lib/forms/admin-event-form-schema'
import { zodToFieldErrors } from '@/lib/forms/zod'
import { verifyDescriptionAssetEventId } from '@/lib/public/description-asset-token'
import { sanitizePublicEventDescriptionHtml } from '@/lib/public/sanitize-event-description'
import { isUploadError } from '@/lib/uploads/errors'
import { uploadEventHeroCover } from '@/lib/uploads/upload-event-cover'
import { validateVenueSubsetForEvent } from '@/lib/venues/assert-event-venue-subset'

async function requireOwner(): Promise<ActionResult<never> | { owner: OwnerGuardContext }> {
  try {
    const owner = await guardOwner()
    return { owner }
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }
}

function parsePayloadField(formData: FormData): unknown {
  const raw = formData.get('payload')
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

async function validatePicBankAndHelpers(
  opts: Pick<AdminEventUpsertInput, 'picAdminProfileId' | 'bankAccountId' | 'helperAdminProfileIds'>,
): Promise<ActionResult<void>> {
  const pic = await prisma.adminProfile.findUnique({
    where: { id: opts.picAdminProfileId },
    select: { id: true, role: true },
  })

  if (!pic || pic.role === AdminRole.Viewer) {
    return fieldError({
      picAdminProfileId: 'PIC tidak valid atau tidak boleh menjadi PIC.',
    })
  }

  const bank = await prisma.picBankAccount.findFirst({
    where: {
      id: opts.bankAccountId,
      ownerAdminProfileId: opts.picAdminProfileId,
      isActive: true,
    },
    select: { id: true },
  })
  if (!bank) {
    return fieldError({
      bankAccountId: 'Rekening tidak milik PIC atau tidak aktif.',
    })
  }

  // Exclude PIC from helpers before validation
  const helperIds = [...new Set(opts.helperAdminProfileIds)].filter(id => id !== opts.picAdminProfileId)

  if (helperIds.length > 0) {
    const rows = await prisma.adminProfile.findMany({
      where: { id: { in: helperIds } },
      select: { id: true },
    })
    if (rows.length !== helperIds.length) {
      return fieldError({
        helperAdminProfileIds: 'Salah satu PIC helper tidak ditemukan.',
      })
    }
  }

  return ok(undefined)
}

function persistedVenueSubsetOrderKey(
  rows: Array<{
    venueMenuItemId: string
    sortOrder: number | null
    venueMenuItem: { sortOrder: number }
  }>,
): string {
  return [...rows]
    .sort(
      (a, b) =>
        (a.sortOrder ?? a.venueMenuItem.sortOrder) - (b.sortOrder ?? b.venueMenuItem.sortOrder) ||
        a.venueMenuItemId.localeCompare(b.venueMenuItemId),
    )
    .map(r => r.venueMenuItemId)
    .join('|')
}

function incomingVenueSubsetOrderKey(rows: AdminEventUpsertInput['linkedVenueMenuItems']): string {
  return [...rows]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.venueMenuItemId.localeCompare(b.venueMenuItemId))
    .map(r => r.venueMenuItemId)
    .join('|')
}

async function validateLinkedVenueMenuOrError(data: AdminEventUpsertInput): Promise<ActionResult<void>> {
  const ids = data.linkedVenueMenuItems.map(l => l.venueMenuItemId)
  const rows = await prisma.venueMenuItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, venueId: true },
  })
  const catalog = new Map(rows.map(r => [r.id, r]))
  if (catalog.size !== ids.length) {
    return rootError('Salah satu item menu tidak dikenal atau bukan milik venue.')
  }
  const msg = validateVenueSubsetForEvent({
    eventVenueId: data.venueId,
    venueMenuItemIds: ids,
    catalogById: catalog,
  })
  return msg ? rootError(msg) : ok(undefined)
}

export async function createAdminEvent(_prev: unknown, formData: FormData): Promise<ActionResult<{ eventId: string }>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const rawPayload = parsePayloadField(formData)
  if (rawPayload === null) return rootError('Format data tidak valid.')

  const parsed = adminEventUpsertSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error))
  }

  const data = parsed.data

  const cover = formData.get('cover')
  const coverFile = cover instanceof File && cover.size > 0 ? cover : undefined
  if (!coverFile) return rootError('Sampul acara wajib diunggah.')

  const vPic = await validatePicBankAndHelpers({
    picAdminProfileId: data.picAdminProfileId,
    bankAccountId: data.bankAccountId,
    helperAdminProfileIds: data.helperAdminProfileIds,
  })
  if (!vPic.ok) return vPic

  const vMenu = await validateLinkedVenueMenuOrError(data)
  if (!vMenu.ok) return vMenu

  const helperIds = [...new Set(data.helperAdminProfileIds)].filter(id => id !== data.picAdminProfileId)

  const clientEventIdRaw = formData.get('descriptionClientEventId')
  const descriptionAssetTokenRaw = formData.get('descriptionAssetToken')

  let id: string
  if (
    typeof clientEventIdRaw === 'string' &&
    clientEventIdRaw.length > 0 &&
    typeof descriptionAssetTokenRaw === 'string' &&
    descriptionAssetTokenRaw.length > 0
  ) {
    const uuidParsed = z.string().uuid().safeParse(clientEventIdRaw)
    if (!uuidParsed.success) {
      return rootError('ID draf tidak valid. Muat ulang halaman.')
    }
    if (!verifyDescriptionAssetEventId(clientEventIdRaw, descriptionAssetTokenRaw)) {
      return rootError('Token deskripsi tidak valid. Muat ulang halaman lalu coba lagi.')
    }
    const taken = await prisma.event.findUnique({
      where: { id: clientEventIdRaw },
      select: { id: true },
    })
    if (taken) {
      return rootError('ID draf bentrok. Muat ulang halaman untuk mendapatkan ID baru.')
    }
    id = clientEventIdRaw
  } else {
    id = randomUUID()
  }

  let slug: string
  try {
    slug = await allocateUniqueEventSlug(prisma, data.title)
  } catch (e) {
    throw e
  }

  let coverPut: { url: string; pathname: string }
  try {
    coverPut = await uploadEventHeroCover({ eventId: id, file: coverFile })
  } catch (e) {
    if (isUploadError(e)) return rootError(e.message)
    throw e
  }

  const description = sanitizePublicEventDescriptionHtml(data.descriptionHtml)
  const openReg = new Date(data.openRegistrationAtIso)
  const closeReg = new Date(data.closeRegistrationAtIso)
  const openGate = new Date(data.openGateAtIso)
  const kickOff = new Date(data.kickOffAtIso)

  try {
    await prisma.$transaction(async tx => {
      await tx.event.create({
        data: {
          id,
          slug,
          title: data.title,
          summary: data.summary,
          description,
          openRegistrationAt: openReg,
          closeRegistrationAt: closeReg,
          openGateAt: openGate,
          kickOffAt: kickOff,
          mandatoryMenuItemIds: data.mandatoryMenuItemIds,
          venueId: data.venueId,
          coverBlobUrl: coverPut.url,
          coverBlobPath: coverPut.pathname,
          registrationManualClosed: data.registrationManualClosed,
          status: data.status,
          multiCategoryPurchase: data.multiCategoryPurchase ?? false,
          requireAllHolderData: data.requireAllHolderData ?? true,
          picAdminProfileId: data.picAdminProfileId,
          bankAccountId: data.bankAccountId,
        },
      })

      await tx.eventVenueMenuItem.createMany({
        data: data.linkedVenueMenuItems.map(m => ({
          eventId: id,
          venueMenuItemId: m.venueMenuItemId,
          sortOrder: m.sortOrder ?? null,
        })),
      })

      if (helperIds.length > 0) {
        await tx.eventPicHelper.createMany({
          data: helperIds.map(adminProfileId => ({
            eventId: id,
            adminProfileId,
          })),
          skipDuplicates: true,
        })
      }
    })
  } catch {
    try {
      await del(coverPut.url)
    } catch {
      // ignore
    }
    return rootError('Gagal menyimpan acara.')
  }

  revalidatePath('/admin/events')
  revalidatePath('/admin')
  revalidatePath('/')

  return ok({ eventId: id })
}

export async function updateAdminEvent(
  eventId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ eventId: string }>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const rawPayload = parsePayloadField(formData)
  if (rawPayload === null) return rootError('Format data tidak valid.')

  const parsed = adminEventUpsertSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error))
  }

  const data = parsed.data

  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      slug: true,
      venueId: true,
      coverBlobUrl: true,
      mandatoryMenuItemIds: true,
      picAdminProfileId: true,
      bankAccountId: true,
      eventVenueMenuItems: {
        select: {
          venueMenuItemId: true,
          sortOrder: true,
          venueMenuItem: { select: { sortOrder: true } },
        },
      },
      helpers: { select: { adminProfileId: true } },
      requireAllHolderData: true,
      _count: { select: { registrations: true } },
    },
  })

  if (!existing) return rootError('Acara tidak ditemukan.')

  const persistedIntegrity: EventIntegritySnapshot = {
    slug: existing.slug,
    venueId: existing.venueId,
    mandatoryMenuItemIds: [...existing.mandatoryMenuItemIds],
    picAdminProfileId: existing.picAdminProfileId,
    bankAccountId: existing.bankAccountId,
  }

  const locked = findLockedViolations({
    registrationCount: existing._count.registrations,
    persisted: persistedIntegrity,
    candidate: {
      venueId: data.venueId,
    },
  })
  if (locked.length > 0) {
    return rootError(`Bidang tidak dapat diubah karena sudah ada pendaftaran: ${locked.join(', ')}.`)
  }

  if (
    findMandatoryMenuLockedViolation({
      registrationCount: existing._count.registrations,
      persisted: persistedIntegrity,
      candidateMandatoryMenuItemIds: data.mandatoryMenuItemIds,
    })
  ) {
    return rootError('Menu wajib tidak dapat diubah karena sudah ada pendaftaran.')
  }

  if (
    existing._count.registrations > 0 &&
    data.requireAllHolderData !== undefined &&
    data.requireAllHolderData !== existing.requireAllHolderData
  ) {
    return rootError('Pengaturan data peserta tidak dapat diubah setelah ada pendaftar.')
  }

  const persistedMenuKey = persistedVenueSubsetOrderKey(existing.eventVenueMenuItems)
  const incomingMenuKey = incomingVenueSubsetOrderKey(data.linkedVenueMenuItems)
  if (existing._count.registrations > 0 && persistedMenuKey !== incomingMenuKey) {
    return rootError('Susunan menu acara tidak dapat diubah karena sudah ada pendaftaran.')
  }

  const vMenu = await validateLinkedVenueMenuOrError(data)
  if (!vMenu.ok) return vMenu

  const candidateSensitivity: Partial<EventIntegritySnapshot> = {
    picAdminProfileId: data.picAdminProfileId,
    bankAccountId: data.bankAccountId,
  }

  const sens = needsSensitiveAcknowledgement({
    persisted: persistedIntegrity,
    candidate: candidateSensitivity,
  })
  if (sens && !data.acknowledgeSensitiveChanges) {
    return rootError('Centang pengakuan untuk mengubah PIC utama atau rekening pembayaran.')
  }

  const vPic = await validatePicBankAndHelpers({
    picAdminProfileId: data.picAdminProfileId,
    bankAccountId: data.bankAccountId,
    helperAdminProfileIds: data.helperAdminProfileIds,
  })
  if (!vPic.ok) return vPic

  const helperIds = [...new Set(data.helperAdminProfileIds)].filter(id => id !== data.picAdminProfileId)

  const cover = formData.get('cover')
  const coverFile = cover instanceof File && cover.size > 0 ? cover : undefined

  let coverPut: { url: string; pathname: string } | null = null
  if (coverFile) {
    try {
      coverPut = await uploadEventHeroCover({
        eventId,
        file: coverFile,
        previousBlobUrl: existing.coverBlobUrl,
        deletePreviousBlob: false,
      })
    } catch (e) {
      if (isUploadError(e)) return rootError(e.message)
      throw e
    }
  }

  const description = sanitizePublicEventDescriptionHtml(data.descriptionHtml)
  const openReg = new Date(data.openRegistrationAtIso)
  const closeReg = new Date(data.closeRegistrationAtIso)
  const openGate = new Date(data.openGateAtIso)
  const kickOff = new Date(data.kickOffAtIso)

  const prevCoverUrl = existing.coverBlobUrl

  try {
    await prisma.$transaction(async tx => {
      if (existing._count.registrations === 0) {
        await tx.eventVenueMenuItem.deleteMany({ where: { eventId } })
        await tx.eventVenueMenuItem.createMany({
          data: data.linkedVenueMenuItems.map(m => ({
            eventId,
            venueMenuItemId: m.venueMenuItemId,
            sortOrder: m.sortOrder ?? null,
          })),
        })
      }

      await tx.eventPicHelper.deleteMany({ where: { eventId } })
      if (helperIds.length > 0) {
        await tx.eventPicHelper.createMany({
          data: helperIds.map(adminProfileId => ({
            eventId,
            adminProfileId,
          })),
          skipDuplicates: true,
        })
      }

      await tx.event.update({
        where: { id: eventId },
        data: {
          title: data.title,
          summary: data.summary,
          description,
          openRegistrationAt: openReg,
          closeRegistrationAt: closeReg,
          openGateAt: openGate,
          kickOffAt: kickOff,
          mandatoryMenuItemIds: data.mandatoryMenuItemIds,
          venueId: data.venueId,
          ...(coverPut
            ? {
                coverBlobUrl: coverPut.url,
                coverBlobPath: coverPut.pathname,
              }
            : {}),
          registrationManualClosed: data.registrationManualClosed,
          status: data.status,
          multiCategoryPurchase: data.multiCategoryPurchase,
          requireAllHolderData: data.requireAllHolderData,
          picAdminProfileId: data.picAdminProfileId,
          bankAccountId: data.bankAccountId,
        },
      })
    })

    if (coverPut && prevCoverUrl.startsWith('http')) {
      try {
        await del(prevCoverUrl)
      } catch {
        // ignore
      }
    }
  } catch (e) {
    if (coverPut) {
      try {
        await del(coverPut.url)
      } catch {
        // ignore
      }
    }
    throw e
  }

  const publicSlug = existing.slug

  revalidatePath('/admin/events')
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/events')
  revalidatePath(`/events/${publicSlug}`)
  revalidatePath(eventRegistrantsListPath(eventId))
  revalidatePath(`/admin/events/${eventId}/edit`)

  return ok({ eventId })
}

export async function deleteAdminEvent(_prev: unknown, formData: FormData): Promise<ActionResult<{ deleted: true }>> {
  const gate = await requireOwner()

  if (!('owner' in gate)) return gate

  const eventId = formData.get('eventId')
  if (!eventId || typeof eventId !== 'string' || eventId.trim() === '') {
    return rootError('ID acara tidak valid.')
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId.trim() },
    select: {
      id: true,
      title: true,
      coverBlobUrl: true,
      _count: { select: { registrations: true } },
    },
  })

  if (!event) return rootError('Acara tidak ditemukan.')

  if (event._count.registrations > 0) {
    return rootError(`Acara tidak bisa dihapus karena memiliki ${event._count.registrations} registrasi.`)
  }

  await del(event.coverBlobUrl).catch(() => undefined)

  try {
    await prisma.event.delete({ where: { id: event.id } })
  } catch {
    return rootError('Gagal menghapus acara. Coba lagi atau periksa apakah ada registrasi baru.')
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.EVENT_DELETED_UI,
    targetType: 'event',
    targetId: event.id,
    metadata: { title: event.title },
  })

  revalidatePath('/admin/events')
  revalidatePath('/')
  revalidatePath('/events')
  revalidatePath(`/admin/events/${event.id}/edit`)

  redirect(`/admin/events?tab=active&flash=${encodeURIComponent(ADMIN_EVENTS_DELETE_SUCCESS_FLASH)}`)
}
