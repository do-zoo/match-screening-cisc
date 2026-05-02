import { z } from "zod";

export const adminManagementMemberCreateSchema = z.object({
  publicCode: z.string().trim().min(1, "Kode publik wajib."),
  fullName: z.string().trim().min(1, "Nama wajib."),
  whatsapp: z.union([z.string().trim().max(64), z.literal("")]).optional(),
  masterMemberId: z.union([z.string().min(1), z.literal(""), z.null()]).optional(),
});

export const adminManagementMemberUpdateSchema =
  adminManagementMemberCreateSchema.extend({
    id: z.string().min(1),
  });

export const deleteManagementMemberSchema = z.object({
  id: z.string().min(1),
});
