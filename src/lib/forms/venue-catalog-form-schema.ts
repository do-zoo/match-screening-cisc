import { z } from 'zod'

const venueCatalogItemSchema = z.object({
  id: z.string().min(1).optional(),
  clientKey: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  description: z
    .string()
    .trim()
    .max(500, 'Deskripsi menu maksimal 500 karakter.')
    .nullable()
    .optional()
    .transform(value => (value && value.length > 0 ? value : null)),
  imageBlobUrl: z.string().trim().url().nullable().optional(),
  imageBlobPath: z.string().trim().min(1).nullable().optional(),
  clearImage: z.boolean().optional(),
  price: z.coerce.number().int().nonnegative(),
  sortOrder: z.coerce.number().int(),
})

export const venueBasicsSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  mapUrl: z.preprocess(
    v => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim()),
    z.union([
      z.null(),
      z
        .string()
        .max(2000, 'Tautan peta maksimal 2000 karakter.')
        .url('Tautan peta harus berupa URL valid (https://…).'),
    ]),
  ),
})

export type VenueBasicsInput = z.infer<typeof venueBasicsSchema>

export const venueMenuOnlyPayloadSchema = z.object({
  items: z.array(venueCatalogItemSchema).min(1),
})

export type VenueMenuOnlyPayload = z.infer<typeof venueMenuOnlyPayloadSchema>

export const venueCatalogPayloadSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  items: z.array(venueCatalogItemSchema).min(1),
})

export type VenueCatalogUiPayload = z.infer<typeof venueCatalogPayloadSchema>
