import type { ClubSocialLink } from '@/lib/branding/club-social-links'
import { hasAnyClubContact } from '@/lib/branding/club-social-links'

export type ClubEmailContactProps = {
  contactEmail: string | null
  websiteUrl: string | null
  locationText: string | null
  socialLinks: ClubSocialLink[]
}

export function formatContactPlainLines(contact: ClubEmailContactProps): string[] {
  if (!hasAnyClubContact(contact)) return []

  const lines: string[] = []
  if (contact.contactEmail?.trim()) {
    lines.push(`Email: ${contact.contactEmail.trim()}`)
  }
  if (contact.websiteUrl?.trim()) {
    lines.push(`Website: ${contact.websiteUrl.trim()}`)
  }
  if (contact.locationText?.trim()) {
    lines.push(`Lokasi: ${contact.locationText.trim()}`)
  }
  for (const link of contact.socialLinks) {
    if (link.label.trim() && link.url.trim()) {
      lines.push(`${link.label.trim()}: ${link.url.trim()}`)
    }
  }
  return lines
}
