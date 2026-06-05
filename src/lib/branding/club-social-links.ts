import { z } from 'zod'

export type ClubSocialLink = { label: string; url: string }

const linkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: z
    .string()
    .trim()
    .url('URL tidak valid')
    .refine(u => u.startsWith('https://'), 'URL harus diawali https://'),
})

const arraySchema = z.array(linkSchema).max(3)

export function parseClubSocialLinks(raw: unknown): ClubSocialLink[] {
  const parsed = arraySchema.safeParse(raw)
  return parsed.success ? parsed.data : []
}

export function hasAnyClubContact(fields: {
  contactEmail: string | null
  websiteUrl: string | null
  locationText: string | null
  socialLinks: ClubSocialLink[]
}): boolean {
  return Boolean(
    fields.contactEmail?.trim() ||
      fields.websiteUrl?.trim() ||
      fields.locationText?.trim() ||
      fields.socialLinks.length > 0,
  )
}
