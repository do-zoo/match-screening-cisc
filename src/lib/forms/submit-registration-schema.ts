import { isValidPhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'
import { toE164PlusForValidation } from '@/lib/forms/phone-value-string'

const contactWhatsappSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    const e164 = toE164PlusForValidation(val)
    if (!e164) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'WhatsApp wajib diisi' })
      return
    }
    if (!isValidPhoneNumber(e164)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nomor WhatsApp tidak valid' })
    }
  })

export const holderSchema = z.object({
  holderName: z.string().trim().min(1, 'Nama pemegang tiket wajib diisi'),
  claimedMemberNumber: z.string().trim().optional(),
  mandatoryMenuItemId: z.string().optional(),
})

export type HolderInput = z.infer<typeof holderSchema>

export const submitRegistrationSchema = z.object({
  ticketCategoryId: z.string().min(1, 'Pilih kategori tiket'),
  ticketQty: z.number().int().min(1, 'Jumlah tiket minimal 1'),
  holders: z.array(holderSchema).min(1, 'Minimal satu pemegang tiket'),
  contactWhatsapp: contactWhatsappSchema,
  transferProof: z.instanceof(File, { message: 'Bukti transfer wajib diunggah' }),
})

export type SubmitRegistrationInput = z.infer<typeof submitRegistrationSchema>
