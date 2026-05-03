"use server";

import { revalidatePath } from "next/cache";

import { ADMIN_INVITE_TTL_MS } from "@/lib/admin/admin-invite-constants";
import { generateAdminInviteToken } from "@/lib/admin/admin-invite-crypto";
import { buildAdminInviteAcceptUrl } from "@/lib/admin/build-admin-invite-url";
import { normalizeAdminInvitationEmail } from "@/lib/admin/admin-invite-email";
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import {
  guardOwner,
  isAuthError,
  type OwnerGuardContext,
} from "@/lib/actions/guard";
import {
  createAdminInvitationSchema,
  revokeAdminInvitationSchema,
} from "@/lib/forms/admin-invitation-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { prisma } from "@/lib/db/prisma";
import { renderAdminInviteEmail } from "@/lib/auth/emails/render-emails";
import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";
import { sendTransactionalEmail } from "@/lib/auth/send-transactional-email";

async function requireOwner(): Promise<
  ActionResult<never> | { owner: OwnerGuardContext }
> {
  try {
    const owner = await guardOwner();
    return { owner };
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }
}

const ROLE_LABEL_EMAIL: Record<string, string> = {
  Admin: "Admin",
  Verifier: "Verifier",
  Viewer: "Viewer",
};

export type CreateAdminInvitationResult = {
  created: true;
  /** Ada jika email tidak dikirim atau gagal dikirim — untuk disalin oleh Owner. */
  inviteUrl?: string;
};

export async function createAdminInvitation(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<CreateAdminInvitationResult>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = createAdminInvitationSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const email = normalizeAdminInvitationEmail(parsed.data.email);

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser) {
    const profile = await prisma.adminProfile.findUnique({
      where: { authUserId: existingUser.id },
      select: { id: true },
    });
    if (profile) {
      return rootError("Email ini sudah terdaftar sebagai admin.");
    }
    return rootError(
      "Email ini sudah punya akun aplikasi tetapi belum punya profil admin. Tidak bisa membuat undangan — gunakan email lain atau hubungi operator.",
    );
  }

  const now = Date.now();
  const activeInvite = await prisma.adminInvitation.findFirst({
    where: {
      emailNormalized: email,
      consumedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date(now) },
    },
    select: { id: true },
  });
  if (activeInvite) {
    return rootError(
      "Sudah ada undangan aktif untuk email ini — batalkan dulu atau tunggu kedaluwarsa.",
    );
  }

  const { rawToken, tokenHash } = generateAdminInviteToken();
  const expiresAt = new Date(now + ADMIN_INVITE_TTL_MS);

  const created = await prisma.adminInvitation.create({
    data: {
      emailNormalized: email,
      role: parsed.data.role,
      tokenHash,
      expiresAt,
      createdByAdminProfileId: gate.owner.profileId,
    },
    select: { id: true },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_INVITATION_CREATED,
    targetType: "admin_invitation",
    targetId: created.id,
    metadata: { email, role: parsed.data.role },
  });

  let inviteUrl: string | undefined;
  try {
    inviteUrl = buildAdminInviteAcceptUrl(rawToken);
  } catch {
    inviteUrl = undefined;
  }

  if (inviteUrl && isTransactionalEmailConfigured()) {
    try {
      const html = await renderAdminInviteEmail(
        inviteUrl,
        ROLE_LABEL_EMAIL[parsed.data.role] ?? parsed.data.role,
      );
      await sendTransactionalEmail({
        to: email,
        subject: "Undangan admin Match Screening",
        text:
          `Anda diundang sebagai ${ROLE_LABEL_EMAIL[parsed.data.role] ?? parsed.data.role}. ` +
          `Buka taut berikut untuk menyelesaikan pengaturan akun (terbatas, satu kali pakai):\n\n${inviteUrl}`,
        html,
      });
      revalidatePath("/admin/settings/committee");
      return ok({ created: true });
    } catch (e) {
      console.error("[createAdminInvitation] email failed", e);
      revalidatePath("/admin/settings/committee");
      return ok({ created: true, inviteUrl });
    }
  }

  revalidatePath("/admin/settings/committee");
  return ok({
    created: true,
    inviteUrl: inviteUrl ?? undefined,
  });
}

export async function revokeAdminInvitation(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ revoked: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = revokeAdminInvitationSchema.safeParse({
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const row = await prisma.adminInvitation.findUnique({
    where: { id: parsed.data.invitationId },
    select: {
      id: true,
      emailNormalized: true,
      consumedAt: true,
      revokedAt: true,
    },
  });
  if (!row) return rootError("Undangan tidak ditemukan.");
  if (row.consumedAt) return rootError("Undangan ini sudah dipakai.");
  if (row.revokedAt) return rootError("Undangan ini sudah dibatalkan.");

  await prisma.adminInvitation.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_INVITATION_REVOKED,
    targetType: "admin_invitation",
    targetId: row.id,
    metadata: { email: row.emailNormalized },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ revoked: true });
}
