/**
 * Teks disamarkan untuk WA/email member (lookup publik & tampilan kartu).
 * Bukan enkripsi kriptografi — hanya redaksi tampilan/wire.
 */
export function maskDisplayWhatsapp(whatsapp: string): string {
  const d = whatsapp.replace(/\D/g, '')
  const n = d.length
  if (n === 0) return '•••'
  if (n <= 5) return `${d[0]}${'•'.repeat(Math.max(3, n - 2))}${d.slice(-1)}`
  const headLen = Math.min(4, n - 3)
  const start = d.slice(0, headLen)
  const end = d.slice(-2)
  const midDots = Math.min(10, Math.max(4, n - headLen - 2))
  return `${start}${'•'.repeat(midDots)}${end}`
}

export function maskDisplayEmail(email: string): string {
  const t = email.normalize('NFKC').trim()
  if (!t) return '—'
  const at = t.indexOf('@')
  if (at <= 0 || at === t.length - 1) {
    if (t.length <= 2) return `${t[0] ?? '•'}•`
    const vis = Math.min(2, t.length)
    return `${t.slice(0, vis)}${'•'.repeat(Math.min(6, Math.max(4, t.length - vis)))}`
  }
  const local = t.slice(0, at)
  const domain = t.slice(at + 1)
  const vis = Math.min(2, local.length)
  const hidden = Math.min(Math.max(4, local.length - vis), 10)
  const localMasked = local.length <= vis ? local : `${local.slice(0, vis)}${'•'.repeat(hidden)}`
  return `${localMasked}@${domain}`
}
