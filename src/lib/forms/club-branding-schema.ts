import { z } from 'zod'

const httpsOptional = z
  .string()
  .optional()
  .transform(v => (v ?? '').trim())
  .refine(v => v === '' || v.startsWith('https://'), 'URL harus diawali https://')

const contactEmailField = z
  .string()
  .optional()
  .transform(v => (v ?? '').trim())
  .superRefine((v, ctx) => {
    if (!v) return
    const parsed = z.string().email('Format email tidak valid.').safeParse(v)
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: 'Format email tidak valid.' })
    }
  })
  .transform(v => (v === '' ? '' : v.toLowerCase()))

const socialLinkInputSchema = z
  .object({
    label: z.string().trim().max(40),
    url: httpsOptional,
  })
  .superRefine((row, ctx) => {
    const hasLabel = row.label.length > 0
    const hasUrl = row.url.length > 0
    if (hasLabel !== hasUrl) {
      ctx.addIssue({
        code: 'custom',
        message: 'Label dan URL sosial harus diisi berpasangan.',
      })
    }
    if (hasLabel && row.label.length < 1) {
      ctx.addIssue({ code: 'custom', message: 'Label sosial wajib diisi.' })
    }
  })

export const clubBrandingTextsSchema = z.object({
  clubNameNav: z.string().trim().min(1, 'Nama klub wajib diisi.').max(120),
  contactEmail: contactEmailField,
  websiteUrl: httpsOptional,
  locationText: z
    .string()
    .optional()
    .transform(v => (v ?? '').trim())
    .transform(v => (v === '' ? '' : v.slice(0, 200))),
  socialLinks: z.array(socialLinkInputSchema).max(3),
})

export type ClubBrandingTextsInput = z.infer<typeof clubBrandingTextsSchema>

export function socialLinksForDb(
  rows: ClubBrandingTextsInput['socialLinks'],
): { label: string; url: string }[] {
  return rows
    .filter(r => r.label.trim() && r.url.trim())
    .map(r => ({ label: r.label.trim(), url: r.url.trim() }))
}
