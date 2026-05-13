import type {
  Event,
  EventStatus,
  PrismaClient,
  RegistrationStatus,
} from "@prisma/client";

import { isRegistrationTimeWindowOpen } from "@/lib/events/event-timing";

/** Accepts root `PrismaClient` or interactive transaction client. */
type DbWithRegistration = Pick<PrismaClient, "registration">;

/** Registrations in these statuses do not consume quota (eligible to open slots again). */
const REGISTRATION_STATUS_EXCLUDED_FROM_QUOTA: readonly RegistrationStatus[] = [
  "rejected",
  "cancelled",
  "refunded",
];

/**
 * Batas kuota hanya berlaku jika kapasitas positif.
 * `null`, `undefined`, atau nilai ≤ 0 diperlakukan sama seperti tak terbatas (selaras dengan form admin: kosong = tak terbatas).
 */
function registrationCapacityLimit(
  registrationCapacity: number | null | undefined,
): number | null {
  if (registrationCapacity == null) return null;
  if (registrationCapacity <= 0) return null;
  return registrationCapacity;
}

/** Fields needed to evaluate whether new registrations are allowed. */
export type EventRegistrationGatePick = Pick<
  Event,
  | "status"
  | "registrationManualClosed"
  | "registrationCapacity"
  | "openRegistrationAt"
  | "closeRegistrationAt"
>;

export class RegistrationNotAcceptableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationNotAcceptableError";
  }
}

export async function countRegistrationsTowardQuota(
  db: DbWithRegistration,
  eventId: string
): Promise<number> {
  return db.registration.count({
    where: {
      eventId,
      status: { notIn: [...REGISTRATION_STATUS_EXCLUDED_FROM_QUOTA] },
    },
  });
}

export function isRegistrationOpenForEvent(args: {
  event: EventRegistrationGatePick;
  registrationsTowardQuota: number;
  now?: Date;
}): boolean {
  const { event, registrationsTowardQuota } = args;
  const now = args.now ?? new Date();
  if (event.status !== "active") return false;
  if (event.registrationManualClosed) return false;
  if (!isRegistrationTimeWindowOpen(event, now)) {
    return false;
  }
  const capacityLimit = registrationCapacityLimit(event.registrationCapacity);
  if (
    capacityLimit != null &&
    registrationsTowardQuota >= capacityLimit
  ) {
    return false;
  }
  return true;
}

/**
 * Indonesian copy for registrants when the form must not proceed.
 * Returns null when registration should be accepted (caller still validates event exists, etc.).
 */
export function registrationBlockMessageForPublic(args: {
  eventStatus: EventStatus;
  registrationManualClosed: boolean;
  registrationCapacity: number | null;
  registrationsTowardQuota: number;
  openRegistrationAt?: Date;
  closeRegistrationAt?: Date;
  now?: Date;
}): string | null {
  const {
    eventStatus,
    registrationManualClosed,
    registrationCapacity,
    registrationsTowardQuota,
    openRegistrationAt,
    closeRegistrationAt,
  } = args;
  const now = args.now ?? new Date();

  if (eventStatus !== "active") {
    return "Event tidak tersedia atau belum aktif.";
  }
  if (registrationManualClosed) {
    return "Pendaftaran untuk acara ini telah ditutup.";
  }
  if (openRegistrationAt && closeRegistrationAt) {
    if (now < openRegistrationAt) {
      return "Pendaftaran untuk acara ini belum dibuka.";
    }
    if (now >= closeRegistrationAt) {
      return "Pendaftaran untuk acara ini sudah ditutup.";
    }
  }
  const capacityLimit = registrationCapacityLimit(registrationCapacity);
  if (capacityLimit != null && registrationsTowardQuota >= capacityLimit) {
    return "Kuota pendaftaran untuk acara ini sudah habis.";
  }
  return null;
}

/** Re-validates quota inside a transaction before creating a registration. */
export async function assertRegistrationAcceptableOrThrowForTx(
  db: DbWithRegistration,
  event: EventRegistrationGatePick & { id: string }
): Promise<void> {
  const registrationsTowardQuota = await countRegistrationsTowardQuota(
    db,
    event.id
  );
  const block = registrationBlockMessageForPublic({
    eventStatus: event.status,
    registrationManualClosed: event.registrationManualClosed,
    registrationCapacity: event.registrationCapacity,
    registrationsTowardQuota,
    openRegistrationAt: event.openRegistrationAt,
    closeRegistrationAt: event.closeRegistrationAt,
  });
  if (block) throw new RegistrationNotAcceptableError(block);
}
