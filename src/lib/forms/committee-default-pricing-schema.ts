import { z } from "zod";

export const committeeDefaultPricingFormSchema = z.object({
  ticketMemberPrice: z.coerce.number().int().nonnegative(),
  ticketNonMemberPrice: z.coerce.number().int().nonnegative(),
});

export type CommitteeDefaultPricingFormInput = z.infer<
  typeof committeeDefaultPricingFormSchema
>;
