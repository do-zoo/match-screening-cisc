import { cache } from 'react'

import { parseClubSocialLinks, type ClubSocialLink } from '@/lib/branding/club-social-links'
import { prisma } from '@/lib/db/prisma'

export const CLUB_BRANDING_SINGLETON_KEY = 'default'

export type PublicClubBrandingVm = {
  clubNameNav: string
  logoBlobUrl: string | null
  contactEmail: string | null
  websiteUrl: string | null
  locationText: string | null
  socialLinks: ClubSocialLink[]
}

export function pickClubEmailContact(branding: PublicClubBrandingVm): Pick<
  PublicClubBrandingVm,
  'contactEmail' | 'websiteUrl' | 'locationText' | 'socialLinks'
> {
  return {
    contactEmail: branding.contactEmail,
    websiteUrl: branding.websiteUrl,
    locationText: branding.locationText,
    socialLinks: branding.socialLinks,
  }
}

export const loadPublicClubBranding = cache(async (): Promise<PublicClubBrandingVm> => {
  const row = await prisma.clubBranding.findUnique({
    where: { singletonKey: CLUB_BRANDING_SINGLETON_KEY },
  })

  if (!row) {
    return {
      clubNameNav: 'CISC Nobar',
      logoBlobUrl: null,
      contactEmail: null,
      websiteUrl: null,
      locationText: null,
      socialLinks: [],
    }
  }

  return {
    clubNameNav: row.clubNameNav,
    logoBlobUrl: row.logoBlobUrl,
    contactEmail: row.contactEmail,
    websiteUrl: row.websiteUrl,
    locationText: row.locationText,
    socialLinks: parseClubSocialLinks(row.socialLinks),
  }
})
