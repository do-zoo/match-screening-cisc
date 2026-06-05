import type { WaTemplateCatalogEntry } from '@/lib/wa-templates/wa-template-catalog'
import { WA_PLACEHOLDER_TOKEN } from '@/lib/wa-templates/wa-placeholder'

export function collectPlaceholderNames(body: string): Set<string> {
  const re = new RegExp(WA_PLACEHOLDER_TOKEN.source, WA_PLACEHOLDER_TOKEN.flags)
  return new Set([...body.matchAll(re)].map(m => m[1]!))
}

export function analyzeWaTemplateMarkdown(
  body: string,
  entry: WaTemplateCatalogEntry,
): { missingRequired: string[]; invalidTokens: string[] } {
  const allowed = new Set([...entry.requiredTokens, ...entry.optionalTokens])
  const found = collectPlaceholderNames(body)
  const missingRequired = entry.requiredTokens.filter(t => !found.has(t))
  const invalidTokens = [...found].filter(t => !allowed.has(t))
  return { missingRequired, invalidTokens }
}

export function sampleVarsFromCatalog(entry: WaTemplateCatalogEntry): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [token, meta] of Object.entries(entry.tokenMeta)) {
    vars[token] = meta.sampleValue
  }
  for (const t of [...entry.requiredTokens, ...entry.optionalTokens]) {
    if (!(t in vars)) vars[t] = `{${t}}`
  }
  return vars
}
