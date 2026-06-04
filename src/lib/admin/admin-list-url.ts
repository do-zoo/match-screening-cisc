/**
 * Membangun URL daftar admin dengan query string.
 * Digunakan bersama `TablePagination` dan toolbar pencarian bertekanan URL.
 */
export function buildAdminListUrl(pathname: string, entries: Record<string, string | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === '') continue
    p.set(k, v)
  }
  const s = p.toString()
  return s ? `${pathname}?${s}` : pathname
}
