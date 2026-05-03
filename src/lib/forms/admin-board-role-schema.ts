import { z } from "zod";

const parentRoleIdField = z.preprocess((val: unknown) => {
  if (val === "__none__" || val === "" || val === null || val === undefined)
    return null;
  return val;
}, z.union([z.string().min(1), z.null()]).optional());

export const adminBoardRoleCreateSchema = z.object({
  title: z.string().trim().min(1, "Nama jabatan wajib."),
  sortOrder: z.coerce.number().int().default(0),
  isUnique: z.boolean().default(true),
  parentRoleId: parentRoleIdField,
});

export const adminBoardRoleUpdateSchema = adminBoardRoleCreateSchema.extend({
  id: z.string().min(1),
});

export const deleteBoardRoleSchema = z.object({
  id: z.string().min(1),
});
