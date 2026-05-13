/** Path daftar peserta/registrasi per acara (bukan lagi `/inbox`). */
export function eventRegistrantsListPath(eventId: string): string {
  return `/admin/events/${eventId}/registrants`;
}

/** Path detail satu baris registrasi. */
export function eventRegistrationDetailPath(
  eventId: string,
  registrationId: string,
): string {
  return `/admin/events/${eventId}/registrants/${registrationId}`;
}
