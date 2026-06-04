import { isValidPhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'
import { toE164PlusForValidation } from '@/lib/forms/phone-value-string'

export const whatsappPhoneSchema = z
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

const holderEmailOptional = z.union([z.string().trim().email('Format email tidak valid.'), z.literal('')]).optional()

export function isTangselDirectoryHolder(data: {
  memberType?: 'tangsel' | 'regional'
  claimedMemberNumber?: string
}): boolean {
  return data.memberType === 'tangsel' && !!data.claimedMemberNumber?.trim()
}

function validateHolderWhatsappIfPresent(val: string | undefined, ctx: z.RefinementCtx) {
  const trimmed = (val ?? '').trim()
  if (!trimmed) return
  const e164 = toE164PlusForValidation(trimmed)
  if (!e164) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nomor WhatsApp tidak valid', path: ['holderWhatsapp'] })
    return
  }
  if (!isValidPhoneNumber(e164)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nomor WhatsApp tidak valid', path: ['holderWhatsapp'] })
  }
}

export const holderSchema = z
  .object({
    holderName: z.string().trim().min(1, 'Nama pemegang tiket wajib diisi'),
    holderWhatsapp: z.string().trim().default(''),
    holderEmail: holderEmailOptional,
    claimedMemberNumber: z.string().trim().optional(),
    mandatoryMenuItemId: z.string().optional(),
    memberType: z.enum(['tangsel', 'regional']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.memberType === 'regional' && !data.claimedMemberNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nomor member wajib diisi',
        path: ['claimedMemberNumber'],
      })
    }

    if (isTangselDirectoryHolder(data)) {
      validateHolderWhatsappIfPresent(data.holderWhatsapp, ctx)
      return
    }

    const waResult = whatsappPhoneSchema.safeParse(data.holderWhatsapp ?? '')
    if (!waResult.success) {
      for (const issue of waResult.error.issues) {
        ctx.addIssue({ ...issue, path: ['holderWhatsapp'] })
      }
    }
  })

export type HolderInput = z.infer<typeof holderSchema>

export const submitRegistrationSchema = z
  .object({
    ticketCategoryId: z.string().min(1, 'Pilih kategori tiket'),
    ticketQty: z.number().int().min(1, 'Jumlah tiket minimal 1'),
    holders: z.array(holderSchema).min(1, 'Minimal satu pemegang tiket'),
  })
  .superRefine((data, ctx) => {
    const first = data.holders[0]
    if (!first) return

    if (isTangselDirectoryHolder(first)) return

    const firstEmail = (first.holderEmail ?? '').trim()
    if (!firstEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email kontak wajib diisi',
        path: ['holders', 0, 'holderEmail'],
      })
    }
  })

export type SubmitRegistrationInput = z.infer<typeof submitRegistrationSchema>
