import { z } from "zod";

const venueCatalogItemSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  price: z.coerce.number().int().nonnegative(),
  sortOrder: z.coerce.number().int(),
  voucherEligible: z.boolean(),
});

export const venueCatalogPayloadSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  items: z.array(venueCatalogItemSchema).min(1),
});

export type VenueCatalogUiPayload = z.infer<typeof venueCatalogPayloadSchema>;
