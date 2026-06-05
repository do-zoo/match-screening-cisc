import { EmailTemplateKey } from '@prisma/client'
import { z } from 'zod'

import { isStoredEmailTemplateBody } from '@/lib/email-templates/email-block-types'
import { validateEmailTemplateBlocks } from '@/lib/email-templates/email-template-editor-validation'

export const saveClubEmailTemplateFormSchema = z
  .object({
    key: z.nativeEnum(EmailTemplateKey),
    subject: z.string().trim().min(1, 'Subjek tidak boleh kosong.').max(200),
    body: z.string().min(2, 'Isi templat tidak boleh kosong.').max(50000),
  })
  .superRefine((data, ctx) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(data.body)
    } catch {
      ctx.addIssue({ code: 'custom', path: ['body'], message: 'Format templat tidak valid.' })
      return
    }
    if (!isStoredEmailTemplateBody(parsed)) {
      ctx.addIssue({ code: 'custom', path: ['body'], message: 'Format templat tidak valid.' })
      return
    }
    const err = validateEmailTemplateBlocks(data.key, data.subject, parsed.blocks)
    if (err) {
      ctx.addIssue({ code: 'custom', path: ['body'], message: err })
    }
  })
