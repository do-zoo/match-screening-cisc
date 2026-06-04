import { EmailTemplateKey } from '@prisma/client'
import { z } from 'zod'

export const saveClubEmailTemplateFormSchema = z.object({
  key: z.nativeEnum(EmailTemplateKey),
  subject: z.string().max(200),
  body: z.string().max(8000),
})
