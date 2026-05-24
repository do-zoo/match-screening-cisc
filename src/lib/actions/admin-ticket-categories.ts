'use server'

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

  const maxSort = await prisma.eventTicketCategory.aggregate({
    where: { eventId },
    _max: { sortOrder: true },
  })
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1

  const category = await prisma.eventTicketCategory.create({
    data: { eventId, ...parsed.data, capacity: parsed.data.capacity ?? null, sortOrder },
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

  const hasRegistrations = (await prisma.registration.count({ where: { ticketCategoryId: categoryId } })) > 0

  const data = hasRegistrations
    ? { name: parsed.data.name, maxQtyPerPerson: parsed.data.maxQtyPerPerson, capacity: parsed.data.capacity }
    : parsed.data

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
