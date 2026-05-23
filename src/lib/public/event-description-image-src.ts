/** Hostname gambar deskripsi yang diizinkan (Vercel Blob publik). */
const BLOB_PUBLIC_SUFFIX = '.public.blob.vercel-storage.com'

/**
 * Memvalidasi `src` gambar inline untuk deskripsi acara (HTTPS + host Blob Vercel).
 */
export function isAllowedEventDescriptionImageSrc(src: string | undefined): boolean {
  if (!src || typeof src !== 'string') return false
  const trimmed = src.trim()
  if (!trimmed) return false
  let u: URL
  try {
    u = new URL(trimmed)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase()
  return h.endsWith(BLOB_PUBLIC_SUFFIX)
}
