import { z } from "zod";

export const adminBoardRoleCreateSchema = z.object({
  title: z.string().trim().min(1, "Nama jabatan wajib."),
  sortOrder: z.coerce.number().int().default(0),
});

export const adminBoardRoleUpdateSchema = adminBoardRoleCreateSchema.extend({
  id: z.string().min(1),
});

export const deleteBoardRoleSchema = z.object({
  id: z.string().min(1),
});
