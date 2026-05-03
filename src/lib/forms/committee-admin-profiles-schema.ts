import { z } from "zod";

import { AdminRole } from "@prisma/client";

const adminRoleEnum = z.enum([
  AdminRole.Owner,
  AdminRole.Admin,
  AdminRole.Verifier,
  AdminRole.Viewer,
]);

export const updateCommitteeAdminRoleSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
  role: adminRoleEnum,
});

export const updateCommitteeAdminMemberLinkSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
  managementMemberId: z
    .string()
    .optional()
    .transform((s) =>
      s == null ? null : s.trim() === "" ? null : s.trim(),
    ),
});

export const revokeCommitteeAdminAccessSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
});

export const deleteCommitteeAdminSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Profil admin wajib."),
});
