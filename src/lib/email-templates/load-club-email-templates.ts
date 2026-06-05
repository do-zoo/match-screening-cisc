import type { EmailTemplateKey } from '@prisma/client'

import type { EmailBlock } from '@/lib/email-templates/email-block-types'
import { prisma } from '@/lib/db/prisma'
import { parseStoredEmailBody } from '@/lib/email-templates/parse-stored-email-body'

export type ClubEmailTemplateRow = {
  subject: string
  /** Raw DB value (JSON v1 or legacy plain). */
  body: string
  blocks: EmailBlock[]
}

export async function loadClubEmailTemplates(): Promise<Partial<Record<EmailTemplateKey, ClubEmailTemplateRow>>> {
  const rows = await prisma.clubEmailTemplate.findMany({
    select: { key: true, subject: true, body: true },
  })
  const out: Partial<Record<EmailTemplateKey, ClubEmailTemplateRow>> = {}
  for (const row of rows) {
    out[row.key] = {
      subject: row.subject,
      body: row.body,
      blocks: parseStoredEmailBody(row.key, row.body),
    }
  }
  return out
}
