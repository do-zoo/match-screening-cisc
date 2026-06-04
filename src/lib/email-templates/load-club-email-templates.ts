import type { EmailTemplateKey } from '@prisma/client'

import { prisma } from '@/lib/db/prisma'

export type ClubEmailTemplateRow = { subject: string; body: string }

export async function loadClubEmailTemplates(): Promise<Partial<Record<EmailTemplateKey, ClubEmailTemplateRow>>> {
  const rows = await prisma.clubEmailTemplate.findMany({
    select: { key: true, subject: true, body: true },
  })
  const out: Partial<Record<EmailTemplateKey, ClubEmailTemplateRow>> = {}
  for (const row of rows) {
    out[row.key] = { subject: row.subject, body: row.body }
  }
  return out
}
