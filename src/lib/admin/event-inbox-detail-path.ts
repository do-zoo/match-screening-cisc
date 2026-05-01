/** True when pathname is a registration detail under event inbox (not the inbox list). */
export function pathsMatchRegistrationDetail(
  pathname: string | null,
  eventId: string,
): boolean {
  if (!pathname) return false;
  if (pathname === `/admin/events/${eventId}/inbox`) return false;
  const prefix = `/admin/events/${eventId}/inbox/`;
  return pathname.startsWith(prefix) && pathname.length > prefix.length;
}
