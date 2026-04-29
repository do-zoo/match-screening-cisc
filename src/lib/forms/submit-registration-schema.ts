import { z } from "zod";

const phone = z.string().trim().min(8, "WhatsApp wajib diisi");

export const submitRegistrationFormSchema = z.object({
  slug: z.string().trim().min(1),
  contactName: z.string().trim().min(2, "Nama wajib diisi"),
  contactWhatsapp: phone,
  claimedMemberNumber: z.string().trim().optional(),
  qtyPartner: z.union([z.literal(0), z.literal(1)]),
  partnerName: z.string().trim().optional(),
  partnerWhatsapp: z.string().trim().optional(),
  partnerMemberNumber: z.string().trim().optional(),
  selectedMenuItemIds: z.array(z.string()).optional(),
});

export type SubmitRegistrationFormValues = z.infer<
  typeof submitRegistrationFormSchema
>;

export type SubmitRegistrationInput = SubmitRegistrationFormValues;
