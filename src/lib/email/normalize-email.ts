import { z } from 'zod'

const emailSchema = z.string().trim().email('Format email tidak valid.')

/** Lowercase + trim untuk penyimpanan. */
export function normalizeStoredEmail(raw: string): string {
  const parsed = emailSchema.parse(raw)
  return parsed.toLowerCase()
}

export function optionalStoredEmail(raw: string | undefined | null): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  return normalizeStoredEmail(t)
}

export function requiredStoredEmail(raw: string): string {
  return normalizeStoredEmail(raw)
}
