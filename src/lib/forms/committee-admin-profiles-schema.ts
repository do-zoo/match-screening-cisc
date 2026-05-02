import { z } from "zod";

import { AdminRole } from "@prisma/client";

const adminRoleEnum = z.enum([
  AdminRole.Owner,
  AdminRole.Admin,
  AdminRole.Verifier,
  AdminRole.Viewer,
]);

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

export const addCommitteeAdminByEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Format email tidak valid.")
    .transform((s) => s.toLowerCase()),
});

export const updateCommitteeAdminRoleSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
  role: adminRoleEnum,
});

export const updateCommitteeAdminMemberLinkSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
  memberId: z
    .string()
    .optional()
    .transform((s) => (s == null ? null : emptyToNull(s))),
});

export const revokeCommitteeAdminAccessSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
});

export const deleteCommitteeAdminSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
});
