import { z } from 'zod'

import { whatsappPhoneSchema } from '@/lib/forms/submit-registration-schema'

export const adminPrimaryRegistrantSchema = z.object({
  registrationId: z.string().min(1, 'ID registrasi wajib.'),
  holderName: z.string().trim().min(1, 'Nama pemesan wajib diisi.'),
  holderWhatsapp: whatsappPhoneSchema,
  holderEmail: z.string().trim().min(1, 'Email wajib diisi.').email('Format email tidak valid.'),
  claimedMemberNumber: z.string().trim().optional(),
})

export type AdminPrimaryRegistrantInput = z.infer<typeof adminPrimaryRegistrantSchema>
