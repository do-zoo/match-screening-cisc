'use server'

import { MemberAccessMode } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { guardOwnerOrAdmin, isAuthError } from '@/lib/actions/guard'
import { ok, rootError, type ActionResult } from '@/lib/forms/action-result'
import { ticketCategorySchema, type TicketCategoryInput } from '@/lib/forms/ticket-category-schema'

export async function createTicketCategory(
  eventId: string,
  input: TicketCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }
  const parsed = ticketCategorySchema.safeParse(input)
  if (!parsed.success) return rootError('Data kategori tidak valid.')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { memberAccessMode: true },
  })
  if (!event) return rootError('Acara tidak ditemukan.')

  const prices =
    event.memberAccessMode !== MemberAccessMode.open
      ? { regularPrice: parsed.data.memberPrice, memberPrice: parsed.data.memberPrice }
      : { regularPrice: parsed.data.regularPrice, memberPrice: parsed.data.memberPrice }

  const maxSort = await prisma.eventTicketCategory.aggregate({
    where: { eventId },
    _max: { sortOrder: true },
  })
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1

  const category = await prisma.eventTicketCategory.create({
    data: { eventId, ...parsed.data, ...prices, capacity: parsed.data.capacity ?? null, sortOrder },
    select: { id: true },
  })
  return ok(category)
}

export async function updateTicketCategory(
  categoryId: string,
  input: TicketCategoryInput,
): Promise<ActionResult<void>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }
  const parsed = ticketCategorySchema.safeParse(input)
  if (!parsed.success) return rootError('Data kategori tidak valid.')

  const existingCategory = await prisma.eventTicketCategory.findUnique({
    where: { id: categoryId },
    select: { event: { select: { memberAccessMode: true } } },
  })
  if (!existingCategory) return rootError('Kategori tidak ditemukan.')

  const hasRegistrations = (await prisma.registration.count({ where: { ticketCategoryId: categoryId } })) > 0

  const memberOnly = existingCategory.event.memberAccessMode !== MemberAccessMode.open
  const syncedPrices = memberOnly
    ? { regularPrice: parsed.data.memberPrice, memberPrice: parsed.data.memberPrice }
    : { regularPrice: parsed.data.regularPrice, memberPrice: parsed.data.memberPrice }

  const data = hasRegistrations
    ? { name: parsed.data.name, maxQtyPerPerson: parsed.data.maxQtyPerPerson, capacity: parsed.data.capacity }
    : { ...parsed.data, ...syncedPrices }

  await prisma.eventTicketCategory.update({ where: { id: categoryId }, data })
  return ok(undefined)
}

export async function deleteTicketCategory(categoryId: string): Promise<ActionResult<void>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }

  const count = await prisma.registration.count({
    where: { ticketCategoryId: categoryId },
  })
  if (count > 0) return rootError(`Tidak dapat dihapus — sudah ada ${count} registrasi untuk kategori ini.`)

  await prisma.eventTicketCategory.delete({ where: { id: categoryId } })
  return ok(undefined)
}

export async function toggleTicketCategoryActive(categoryId: string, isActive: boolean): Promise<ActionResult<void>> {
  try {
    await guardOwnerOrAdmin()
  } catch (e) {
    if (isAuthError(e)) return rootError('Tidak diizinkan.')
    throw e
  }
  await prisma.eventTicketCategory.update({
    where: { id: categoryId },
    data: { isActive },
  })
  return ok(undefined)
}
