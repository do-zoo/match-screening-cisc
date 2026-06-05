import { contactPlatformFromRegistry } from '@/lib/branding/contact-icon-registry'
import type { ContactPlatformKey } from '@/lib/branding/contact-platform'

const ICON_BASE = '/branding-icons'

export function brandingIconPublicPath(platform: ContactPlatformKey): string {
  const file = contactPlatformFromRegistry(platform).pngFileName
  return `${ICON_BASE}/${file}`
}

export function brandingIconAbsoluteUrl(
  platform: ContactPlatformKey,
  appOrigin: string | undefined | null,
): string | null {
  const origin = appOrigin?.trim().replace(/\/$/, '')
  if (!origin) return null
  return new URL(brandingIconPublicPath(platform), origin).href
}
