import { isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'
import { z } from 'zod'

export const phoneValueSchema = z
  .object({
    countryCode: z.string().min(1, 'Pilih kode negara'),
    countryIso: z.string().min(1, 'Pilih kode negara'),
    nationalNumber: z.string().trim().min(1, 'Nomor telepon wajib diisi'),
  })
  .superRefine((val, ctx) => {
    if (!val.nationalNumber) return
    try {
      const valid = isValidPhoneNumber(val.nationalNumber, val.countryIso as CountryCode)
      if (!valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Nomor telepon tidak valid',
          path: ['nationalNumber'],
        })
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nomor telepon tidak valid',
        path: ['nationalNumber'],
      })
    }
  })

export type PhoneValue = z.infer<typeof phoneValueSchema>
