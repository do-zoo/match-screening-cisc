import { contactPlatformFromRegistry } from '@/lib/branding/contact-icon-registry'
import type { ContactPlatformKey } from '@/lib/branding/contact-platform'
import { normalizeHostname } from '@/lib/branding/contact-platform'

export function resolveContactDisplayLabel(input: {
  label: string
  url: string
  platform: ContactPlatformKey
}): string {
  const trimmed = input.label.trim()
  if (trimmed) return trimmed

  const entry = contactPlatformFromRegistry(input.platform)
  if (input.platform !== 'link' && entry.defaultLabel) return entry.defaultLabel

  try {
    return normalizeHostname(new URL(input.url).hostname)
  } catch {
    return input.url.trim() || 'Tautan'
  }
}

export function websiteLinkLabel(): string {
  return 'Website'
}
