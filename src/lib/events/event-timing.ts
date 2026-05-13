/**
 * Utilitas murni untuk fase waktu acara (tanpa cek status aktif / kuota —
 * itu di `registration-window.ts`).
 */

export type EventTimingPick = {
  openRegistrationAt: Date;
  closeRegistrationAt: Date;
  openGateAt: Date;
  kickOffAt: Date;
};

/** `now` di dalam [openRegistrationAt, closeRegistrationAt). */
export function isRegistrationTimeWindowOpen(
  event: Pick<EventTimingPick, "openRegistrationAt" | "closeRegistrationAt">,
  now: Date = new Date(),
): boolean {
  return now >= event.openRegistrationAt && now < event.closeRegistrationAt;
}

/** Sebelum tutup registrasi (untuk kebijakan “edit sensitif” / UX admin). */
export function canEditEventBeforeRegistrationClose(
  event: Pick<EventTimingPick, "closeRegistrationAt">,
  now: Date = new Date(),
): boolean {
  return now < event.closeRegistrationAt;
}

export type EventTimePhase =
  | "before_registration"
  | "registration_open"
  | "registration_closed_before_gate"
  | "gates_open"
  | "after_kickoff";

/**
 * Fase berbasis waktu saja. Setelah `kickOffAt` tidak ada field “selesai acara”
 * di schema — semua waktu setelah kick-off digabung ke `after_kickoff`.
 */
export function getEventPhase(
  event: EventTimingPick,
  now: Date = new Date(),
): EventTimePhase {
  if (now < event.openRegistrationAt) return "before_registration";
  if (now < event.closeRegistrationAt) return "registration_open";
  if (now < event.openGateAt) return "registration_closed_before_gate";
  if (now < event.kickOffAt) return "gates_open";
  return "after_kickoff";
}
