import { WaTemplateKey } from '@prisma/client'

import { allowedTokensForKey, getWaTemplateEntry } from '@/lib/wa-templates/wa-template-catalog'
import { WA_PLACEHOLDER_TOKEN } from '@/lib/wa-templates/wa-placeholder'

/** Placeholder `{…}` yang wajib muncul paling tidak sekali dalam `body`. */
export const REQUIRED_TOKENS: Record<WaTemplateKey, readonly string[]> = Object.fromEntries(
  (Object.values(WaTemplateKey).filter(v => typeof v === 'string') as WaTemplateKey[]).map(key => [
    key,
    getWaTemplateEntry(key).requiredTokens,
  ]),
) as Record<WaTemplateKey, readonly string[]>

function collectPlaceholderNames(body: string): string[] {
  const re = new RegExp(WA_PLACEHOLDER_TOKEN.source, WA_PLACEHOLDER_TOKEN.flags)
  return [...body.matchAll(re)].map(m => m[1]!)
}

export function validateWaTemplateBody(key: WaTemplateKey, body: string): string | null {
  const trimmed = body.trim()
  if (trimmed.length === 0) return 'Isi templat tidak boleh kosong.'
  const entry = getWaTemplateEntry(key)
  const names = new Set(collectPlaceholderNames(trimmed))
  for (const r of entry.requiredTokens) {
    if (!names.has(r)) return `Templat wajib memuat placeholder {${r}}`
  }
  const allowed = new Set(allowedTokensForKey(key))
  for (const n of collectPlaceholderNames(trimmed)) {
    if (!allowed.has(n)) return `Placeholder {${n}} tidak diperbolehkan untuk templat ini.`
  }
  return null
}
