import { z } from 'zod'

const optionalHolderEmail = z.union([z.string().trim().email('Format email tidak valid.'), z.literal('')]).optional()

export const adminRegistrationContactSchema = z.object({
  registrationId: z.string().min(1, 'ID registrasi wajib.'),
  contactEmail: z.string().trim().min(1, 'Email kontak wajib.').email('Format email tidak valid.'),
  holders: z.array(
    z.object({
      id: z.string().min(1),
      holderEmail: optionalHolderEmail,
    }),
  ),
})

export type AdminRegistrationContactInput = z.infer<typeof adminRegistrationContactSchema>
