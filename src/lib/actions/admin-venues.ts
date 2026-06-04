'use server'

import { randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { z } from 'zod'

import { guardOwnerOrAdmin, isAuthError } from '@/lib/actions/guard'
import { prisma } from '@/lib/db/prisma'
import { fieldError, ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import {
  venueBasicsSchema,
  venueCatalogPayloadSchema,
  venueMenuOnlyPayloadSchema,
  type VenueCatalogUiPayload,
} from '@/lib/forms/venue-catalog-form-schema'
import { zodToFieldErrors } from '@/lib/forms/zod'
import { isUploadError } from '@/lib/uploads/errors'
import { deleteVenueMenuImage, uploadVenueMenuImage } from '@/lib/uploads/upload-venue-menu-image'
import { venueMenuItemIdsFrozenByExistingRegistrations } from '@/lib/venues/venue-menu-frozen-item-ids'

function parsePayloadField(input: unknown): unknown {
  if (!(input instanceof FormData)) return input
  const raw = input.get('payload')
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function menuImageFileForRow(formData: FormData | null, row: VenueCatalogUiPayload['items'][number]): File | null {
  if (!formData) return null
  const key = row.id ?? row.clientKey
  if (!key) return null
  const file = formData.get(`menuImage:${key}`)
  return file instanceof File && file.size > 0 ? file : null
}

function revalidateVenueAdminPaths(venueId: string) {
  revalidatePath('/admin/venues')
  revalidatePath(`/admin/venues/${venueId}/edit`)
  revalidatePath(`/admin/venues/${venueId}/menu`)
  revalidatePath('/admin/events')
}

async function persistVenueMenuItems(
  venueId: string,
  items: VenueCatalogUiPayload['items'],
  formData: FormData | null,
  venueBasics: { name: string; address: string } | null,
): Promise<ActionResult<{ venueId: string }>> {
  if (!items.length) {
    return rootError('Venue minimal memiliki satu item menu dengan nama valid.')
  }

  const frozen = await venueMenuItemIdsFrozenByExistingRegistrations(prisma)
  const rowsWithPersistedIds = items.map(row => ({
    ...row,
    persistedId: row.id ?? randomUUID(),
  }))
  const uploadedImagesById = new Map<string, { url: string; pathname: string }>()
  const uploadedUrlsForRollback: string[] = []
  const staleImageUrlsAfterCommit: string[] = []

  try {
    for (const row of rowsWithPersistedIds) {
      const file = menuImageFileForRow(formData, row)
      if (!file) continue
      const uploaded = await uploadVenueMenuImage({
        venueId,
        menuItemId: row.persistedId,
        file,
      })
      uploadedImagesById.set(row.persistedId, uploaded)
      uploadedUrlsForRollback.push(uploaded.url)
    }
  } catch (e) {
    if (isUploadError(e)) {
      return rootError(e.message)
    }
    throw e
  }

  try {
    await prisma.$transaction(async tx => {
      const venueExists = await tx.venue.findUnique({
        where: { id: venueId },
        select: { id: true },
      })
      if (!venueExists) {
        throw new Error('__VENUE_NOT_FOUND__')
      }

      if (venueBasics !== null) {
        await tx.venue.update({
          where: { id: venueId },
          data: {
            name: venueBasics.name,
            address: venueBasics.address,
          },
        })
      }

      const existingRows = await tx.venueMenuItem.findMany({
        where: { venueId },
        select: {
          id: true,
          name: true,
          price: true,
          imageBlobUrl: true,
          imageBlobPath: true,
        },
      })
      const existingIds = new Set(existingRows.map(r => r.id))

      const persistedIncomingIds = new Set(
        rowsWithPersistedIds.flatMap(it => (typeof it.id === 'string' && existingIds.has(it.id) ? [it.id] : [])),
      )

      for (const oldId of existingIds) {
        if (!persistedIncomingIds.has(oldId)) {
          if (frozen.has(oldId)) {
            throw new Error('__VENUE_MENU_DELETE_FROZEN__')
          }
          const prev = existingRows.find(x => x.id === oldId)
          if (prev?.imageBlobUrl) staleImageUrlsAfterCommit.push(prev.imageBlobUrl)
          await tx.venueMenuItem.delete({ where: { id: oldId } })
        }
      }

      for (const row of rowsWithPersistedIds) {
        const uploaded = uploadedImagesById.get(row.persistedId)
        const prev = existingRows.find(x => x.id === row.persistedId)
        const hasIncomingImageMetadata = row.imageBlobUrl !== undefined || row.imageBlobPath !== undefined
        const nextImageBlobUrl = uploaded
          ? uploaded.url
          : row.clearImage
            ? null
            : hasIncomingImageMetadata
              ? (row.imageBlobUrl ?? null)
              : (prev?.imageBlobUrl ?? null)
        const nextImageBlobPath = uploaded
          ? uploaded.pathname
          : row.clearImage
            ? null
            : hasIncomingImageMetadata
              ? (row.imageBlobPath ?? null)
              : (prev?.imageBlobPath ?? null)

        if (typeof row.id === 'string' && persistedIncomingIds.has(row.id)) {
          if (frozen.has(row.id)) {
            if (prev && (prev.name !== row.name.trim() || prev.price !== row.price)) {
              throw new Error('__VENUE_MENU_EDIT_FROZEN__')
            }
          }

          await tx.venueMenuItem.update({
            where: { id: row.id },
            data: {
              name: row.name.trim(),
              description: row.description ?? null,
              imageBlobUrl: nextImageBlobUrl,
              imageBlobPath: nextImageBlobPath,
              price: row.price,
              sortOrder: row.sortOrder,
            },
          })
          if ((uploaded || row.clearImage) && prev?.imageBlobUrl && prev.imageBlobUrl !== nextImageBlobUrl) {
            staleImageUrlsAfterCommit.push(prev.imageBlobUrl)
          }
        } else {
          await tx.venueMenuItem.create({
            data: {
              id: row.persistedId,
              venueId,
              name: row.name.trim(),
              description: row.description ?? null,
              imageBlobUrl: nextImageBlobUrl,
              imageBlobPath: nextImageBlobPath,
              price: row.price,
              sortOrder: row.sortOrder,
            },
          })
        }
      }
    })
  } catch (e) {
    await Promise.all(uploadedUrlsForRollback.map(deleteVenueMenuImage))
    if (typeof e === 'object' && e instanceof Error) {
      if (e.message === '__VENUE_NOT_FOUND__') {
        return rootError('Venue tidak ditemukan.')
      }
      if (e.message === '__VENUE_MENU_DELETE_FROZEN__') {
        return rootError('Item menu tidak bisa dihapus karena dipakai acara dengan pendaftaran.')
      }
      if (e.message === '__VENUE_MENU_EDIT_FROZEN__') {
        return rootError('Item menu terkunci — tidak bisa mengubah nama atau harga untuk acara yang ada.')
      }
    }
    throw e
  }

  await Promise.all(staleImageUrlsAfterCommit.map(deleteVenueMenuImage))

  revalidateVenueAdminPaths(venueId)

  return ok({ venueId })
}

export async function createVenueMinimal(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ venueId: string }>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const name = String(formData.get('name') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()

  if (name.length < 1) return fieldError({ name: 'Nama venue wajib diisi.' })
  if (address.length < 1) return fieldError({ address: 'Alamat venue wajib diisi.' })

  const mapUrlRaw = String(formData.get('mapUrl') ?? '').trim()
  const mapUrlParsed = z
    .union([z.literal(''), z.string().max(2000).url('Tautan peta harus berupa URL valid (https://…).')])
    .safeParse(mapUrlRaw)
  if (!mapUrlParsed.success) {
    const msg = mapUrlParsed.error.issues[0]?.message ?? 'Tautan peta harus berupa URL valid (https://…).'
    return fieldError({ mapUrl: msg })
  }
  const mapUrl = mapUrlRaw === '' ? null : mapUrlRaw

  const venue = await prisma.venue.create({
    data: {
      name,
      address,
      mapUrl,
      menuItems: {
        create: {
          name: 'Contoh menu — sesuaikan nama & harga',
          price: 0,
          sortOrder: 1,
        },
      },
    },
    select: { id: true },
  })

  revalidatePath('/admin/venues')

  redirect(`/admin/venues/${venue.id}/edit`)
}

export async function saveVenueBasics(venueId: string, formData: FormData): Promise<ActionResult<{ venueId: string }>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const parsed = venueBasicsSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    address: String(formData.get('address') ?? '').trim(),
    mapUrl: String(formData.get('mapUrl') ?? ''),
  })
  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error))
  }

  const exists = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true },
  })
  if (!exists) {
    return rootError('Venue tidak ditemukan.')
  }

  await prisma.venue.update({
    where: { id: venueId },
    data: {
      name: parsed.data.name,
      address: parsed.data.address,
      mapUrl: parsed.data.mapUrl,
    },
  })

  revalidateVenueAdminPaths(venueId)

  return ok({ venueId })
}

export async function saveVenueMenu(venueId: string, formData: FormData): Promise<ActionResult<{ venueId: string }>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const parsed = venueMenuOnlyPayloadSchema.safeParse(parsePayloadField(formData))
  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error))
  }

  return persistVenueMenuItems(venueId, parsed.data.items, formData, null)
}

export async function saveVenueCatalog(
  venueId: string,
  formDataOrPayload: unknown,
): Promise<ActionResult<{ venueId: string }>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const formData = formDataOrPayload instanceof FormData ? formDataOrPayload : null
  const parsed = venueCatalogPayloadSchema.safeParse(parsePayloadField(formDataOrPayload))
  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error))
  }

  const { name, address, items } = parsed.data

  return persistVenueMenuItems(venueId, items, formData, { name, address })
}
