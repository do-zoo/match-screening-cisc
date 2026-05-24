import type { Event, EventStatus, PrismaClient, RegistrationStatus } from '@prisma/client'

import { isRegistrationTimeWindowOpen } from '@/lib/events/event-timing'

/** Accepts root `PrismaClient` or interactive transaction client. */
type DbWithRegistration = Pick<PrismaClient, 'registration'>

/** Registrations in these statuses do not consume quota (eligible to open slots again). */
const REGISTRATION_STATUS_EXCLUDED_FROM_QUOTA: readonly RegistrationStatus[] = ['rejected', 'cancelled', 'refunded']

/** Fields needed to evaluate whether new registrations are allowed. */
export type EventRegistrationGatePick = Pick<
  Event,
  'status' | 'registrationManualClosed' | 'openRegistrationAt' | 'closeRegistrationAt'
>

export class RegistrationNotAcceptableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegistrationNotAcceptableError'
  }
}

export async function countRegistrationsTowardQuota(db: DbWithRegistration, eventId: string): Promise<number> {
  return db.registration.count({
    where: {
      eventId,
      status: { notIn: [...REGISTRATION_STATUS_EXCLUDED_FROM_QUOTA] },
    },
  })
}

export async function countCategoryRegistrationsTowardQuota(
  db: DbWithRegistration,
  categoryId: string,
): Promise<number> {
  return db.registration.count({
    where: {
      ticketCategoryId: categoryId,
      status: { notIn: [...REGISTRATION_STATUS_EXCLUDED_FROM_QUOTA] },
    },
  })
}

export function isRegistrationOpenForEvent(args: {
  event: EventRegistrationGatePick
  now?: Date
}): boolean {
  const { event } = args
  const now = args.now ?? new Date()
  if (event.status !== 'active') return false
  if (event.registrationManualClosed) return false
  if (!isRegistrationTimeWindowOpen(event, now)) {
    return false
  }
  return true
}

/**
 * Indonesian copy for registrants when the form must not proceed.
 * Returns null when registration should be accepted (caller still validates event exists, etc.).
 */
export function registrationBlockMessageForPublic(args: {
  eventStatus: EventStatus
  registrationManualClosed: boolean
  openRegistrationAt?: Date
  closeRegistrationAt?: Date
  now?: Date
}): string | null {
  const { eventStatus, registrationManualClosed, openRegistrationAt, closeRegistrationAt } = args
  const now = args.now ?? new Date()

  if (eventStatus !== 'active') {
    return 'Event tidak tersedia atau belum aktif.'
  }
  if (registrationManualClosed) {
    return 'Pendaftaran untuk acara ini telah ditutup.'
  }
  if (openRegistrationAt && closeRegistrationAt) {
    if (now < openRegistrationAt) {
      return 'Pendaftaran untuk acara ini belum dibuka.'
    }
    if (now >= closeRegistrationAt) {
      return 'Pendaftaran untuk acara ini sudah ditutup.'
    }
  }
  return null
}

/** Re-validates event-level gate inside a transaction before creating a registration. */
export async function assertRegistrationAcceptableOrThrowForTx(
  db: DbWithRegistration,
  event: EventRegistrationGatePick & { id: string },
): Promise<void> {
  const block = registrationBlockMessageForPublic({
    eventStatus: event.status,
    registrationManualClosed: event.registrationManualClosed,
    openRegistrationAt: event.openRegistrationAt,
    closeRegistrationAt: event.closeRegistrationAt,
  })
  if (block) throw new RegistrationNotAcceptableError(block)
}

/** Re-validates per-category quota inside a transaction before creating a registration. */
export async function assertCategoryCapacityOrThrowForTx(
  db: DbWithRegistration,
  category: { id: string; capacity: number | null },
): Promise<void> {
  if (category.capacity == null || category.capacity <= 0) return
  const count = await countCategoryRegistrationsTowardQuota(db, category.id)
  if (count >= category.capacity) {
    throw new RegistrationNotAcceptableError('Kuota kategori tiket ini sudah habis.')
  }
}
