import type { ContactPlatformKey } from '@/lib/branding/contact-platform'

export type ContactIconRegistryEntry = {
  pngFileName: string
  defaultLabel?: string
}

export const CONTACT_ICON_REGISTRY: Record<ContactPlatformKey, ContactIconRegistryEntry> = {
  email: { pngFileName: 'email.png' },
  website: { pngFileName: 'website.png' },
  location: { pngFileName: 'location.png' },
  link: { pngFileName: 'link.png' },
  instagram: { pngFileName: 'instagram.png', defaultLabel: 'Instagram' },
  facebook: { pngFileName: 'facebook.png', defaultLabel: 'Facebook' },
  youtube: { pngFileName: 'youtube.png', defaultLabel: 'YouTube' },
  tiktok: { pngFileName: 'tiktok.png', defaultLabel: 'TikTok' },
  x: { pngFileName: 'x.png', defaultLabel: 'X' },
  linkedin: { pngFileName: 'linkedin.png', defaultLabel: 'LinkedIn' },
  whatsapp: { pngFileName: 'whatsapp.png', defaultLabel: 'WhatsApp' },
  threads: { pngFileName: 'threads.png', defaultLabel: 'Threads' },
}

export function contactPlatformFromRegistry(key: ContactPlatformKey): ContactIconRegistryEntry {
  return CONTACT_ICON_REGISTRY[key]
}
