import { z } from 'zod'

export const ticketCategorySchema = z.object({
  name: z.string().trim().min(1, 'Nama kategori wajib diisi'),
  regularPrice: z.number().int().min(0, 'Harga reguler tidak boleh negatif'),
  memberPrice: z.number().int().min(0, 'Harga member tidak boleh negatif'),
  maxQtyPerPerson: z.number().int().min(1).nullable(),
  capacity: z.number().int().min(1).nullable(),
})

export type TicketCategoryInput = z.infer<typeof ticketCategorySchema>
