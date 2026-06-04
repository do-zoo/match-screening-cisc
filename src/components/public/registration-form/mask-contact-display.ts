/**
 * Teks disamarkan untuk tampilan publik pada kartu kontak (bukan enkripsi kriptografi).
 */
export { maskDisplayEmail, maskDisplayWhatsapp } from '@/lib/members/mask-member-contact-display'

export function maskDisplayName(fullName: string): string {
  const t = fullName.normalize('NFKC').trim()
  if (t.length === 0) return '•••'
  if (t.length <= 2) return `${t[0]}•`
  const vis = Math.min(2, t.length)
  const hidden = Math.min(Math.max(4, t.length - vis), 12)
  return `${t.slice(0, vis)}${'•'.repeat(hidden)}`
}

export function contactInitials(name: string, maxLetters = 2): string {
  const parts = name.normalize('NFKC').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) {
    const w = parts[0]!
    return w.slice(0, maxLetters).toUpperCase()
  }
  return ((parts[0]![0] ?? '') + (parts[1]?.[0] ?? parts[0]![1] ?? '')).toUpperCase().slice(0, maxLetters)
}
