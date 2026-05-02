import { z } from "zod";

const periodBoundsSchema = z
  .object({
    label: z.string().trim().min(1, "Label wajib."),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: "Tanggal akhir harus setelah tanggal mulai.",
    path: ["endsAt"],
  });

export const adminBoardPeriodCreateSchema = periodBoundsSchema;

export const adminBoardPeriodUpdateSchema = periodBoundsSchema.extend({
  id: z.string().min(1),
});

export type AdminBoardPeriodCreateInput = z.infer<
  typeof adminBoardPeriodCreateSchema
>;
export type AdminBoardPeriodUpdateInput = z.infer<
  typeof adminBoardPeriodUpdateSchema
>;

export const deleteBoardPeriodSchema = z.object({
  id: z.string().min(1),
});
