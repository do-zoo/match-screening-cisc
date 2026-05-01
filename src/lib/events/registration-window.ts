import type {
  Event,
  EventStatus,
  PrismaClient,
  RegistrationStatus,
} from "@prisma/client";

/** Accepts root `PrismaClient` or interactive transaction client. */
type DbWithRegistration = Pick<PrismaClient, "registration">;

/** Registrations in these statuses do not consume quota (eligible to open slots again). */
const REGISTRATION_STATUS_EXCLUDED_FROM_QUOTA: readonly RegistrationStatus[] = [
  "rejected",
  "cancelled",
  "refunded",
];

/** Fields needed to evaluate whether new registrations are allowed. */
export type EventRegistrationGatePick = Pick<
  Event,
  "status" | "registrationManualClosed" | "registrationCapacity"
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
}): boolean {
  const { event, registrationsTowardQuota } = args;
  if (event.status !== "active") return false;
  if (event.registrationManualClosed) return false;
  if (
    event.registrationCapacity != null &&
    registrationsTowardQuota >= event.registrationCapacity
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
}): string | null {
  const {
    eventStatus,
    registrationManualClosed,
    registrationCapacity,
    registrationsTowardQuota,
  } = args;

  if (eventStatus !== "active") {
    return "Event tidak tersedia atau belum aktif.";
  }
  if (registrationManualClosed) {
    return "Pendaftaran untuk acara ini telah ditutup.";
  }
  if (
    registrationCapacity != null &&
    registrationsTowardQuota >= registrationCapacity
  ) {
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
  });
  if (block) throw new RegistrationNotAcceptableError(block);
}
