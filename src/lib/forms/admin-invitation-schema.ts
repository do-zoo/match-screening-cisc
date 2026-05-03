import { z } from "zod";

import { AdminRole } from "@prisma/client";

/** Peran yang boleh di-assign lewat undangan (bukan Owner). */
export const adminInvitableRoleSchema = z.enum([
  AdminRole.Admin,
  AdminRole.Verifier,
  AdminRole.Viewer,
]);

export const createAdminInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Format email tidak valid.")
    .transform((s) => s.toLowerCase()),
  role: adminInvitableRoleSchema,
});

export const revokeAdminInvitationSchema = z.object({
  invitationId: z.string().trim().min(1, "Undangan tidak valid."),
});

export const acceptAdminInvitationSchema = z.object({
  token: z.string().trim().min(1, "Taut tidak valid."),
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(120, "Nama terlalu panjang."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter."),
});
