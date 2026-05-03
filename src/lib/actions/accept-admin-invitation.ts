"use server";

import { auth } from "@/lib/auth/auth";
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { acceptAdminInvitationSchema } from "@/lib/forms/admin-invitation-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { prisma } from "@/lib/db/prisma";
import { hashAdminInviteToken } from "@/lib/admin/admin-invite-crypto";
import { normalizeAdminInvitationEmail } from "@/lib/admin/admin-invite-email";

/** Setelah sukses, pengguna diarahkan ke halaman masuk admin. */
export async function acceptAdminInvitation(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = acceptAdminInvitationSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const tokenHash = hashAdminInviteToken(parsed.data.token);

  const invite = await prisma.adminInvitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      emailNormalized: true,
      role: true,
      expiresAt: true,
      consumedAt: true,
      revokedAt: true,
    },
  });

  if (!invite || invite.revokedAt) {
    return rootError("Taut tidak valid atau undangan dibatalkan.");
  }
  if (invite.consumedAt) {
    return rootError("Undangan ini sudah dipakai. Masuk dengan akun Anda.");
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    return rootError("Undangan sudah kedaluwarsa. Minta Owner mengirim undangan baru.");
  }

  const email = normalizeAdminInvitationEmail(invite.emailNormalized);

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser) {
    return rootError(
      "Akun dengan email ini sudah ada. Hubungi Owner — jangan gunakan formulir ini.",
    );
  }

  let authUserId: string;
  try {
    const data = await auth.api.signUpEmail({
      body: {
        email,
        password: parsed.data.password,
        name: parsed.data.name,
      },
    });
    authUserId = data.user?.id ?? "";
  } catch (e: unknown) {
    console.error("[acceptAdminInvitation] signUpEmail", e);
    return rootError(
      "Tidak bisa membuat akun saat ini. Coba lagi atau hubungi Owner.",
    );
  }
  if (!authUserId) {
    return rootError("Registrasi gagal tanpa penjelasan dari server.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminProfile.create({
        data: { authUserId, role: invite.role },
      });

      await tx.adminInvitation.update({
        where: { id: invite.id },
        data: { consumedAt: new Date() },
      });
    });

    const profile = await prisma.adminProfile.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    const profileId = profile?.id;
    if (!profileId) {
      throw new Error("missing profile after transaction");
    }

    await appendClubAuditLog(prisma, {
      actorProfileId: profileId,
      actorAuthUserId: authUserId,
      action: CLUB_AUDIT_ACTION.ADMIN_INVITATION_CONSUMED,
      targetType: "admin_invitation",
      targetId: invite.id,
      metadata: { email, role: invite.role },
    });

    return ok({ redirectTo: "/admin/sign-in" });
  } catch (e) {
    console.error("[acceptAdminInvitation] profile/invite finalize", e);
    return rootError(
      "Akun auth terbentuk tetapi profil admin gagal disimpan — hubungi Owner.",
    );
  }
}
