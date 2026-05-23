import { eventRegistrantsListPath } from '@/lib/admin/event-registrants-paths'

/** True bila pathname adalah detail registrasi (bukan daftar peserta). */
export function pathsMatchRegistrationDetail(pathname: string | null, eventId: string): boolean {
  if (!pathname) return false
  const list = eventRegistrantsListPath(eventId)
  if (pathname === list) return false
  const prefix = `${list}/`
  return pathname.startsWith(prefix) && pathname.length > prefix.length
}
