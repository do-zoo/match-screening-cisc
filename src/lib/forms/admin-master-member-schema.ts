import { z } from "zod";

const memberNumberSchema = z.string().trim().min(1, "Nomor member wajib.");
const nameSchema = z.string().trim().min(1, "Nama wajib.");

export const adminMasterMemberCreateSchema = z.object({
  memberNumber: memberNumberSchema,
  fullName: nameSchema,
  whatsapp: z.union([z.string().trim().max(64), z.literal("")]).optional(),
  isActive: z.boolean(),
  isPengurus: z.boolean(),
  canBePIC: z.boolean(),
});

export const adminMasterMemberUpdateSchema = z.object({
  id: z.string().min(1),
  fullName: nameSchema,
  whatsapp: z.union([z.string().trim().max(64), z.literal("")]).optional(),
  isActive: z.boolean(),
  isPengurus: z.boolean(),
  canBePIC: z.boolean(),
});

export type AdminMasterMemberCreateInput = z.infer<
  typeof adminMasterMemberCreateSchema
>;
export type AdminMasterMemberUpdateInput = z.infer<
  typeof adminMasterMemberUpdateSchema
>;
