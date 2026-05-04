import { prisma } from "@/lib/db/prisma";

/** Server-side helper: compares expiry to wall clock outside React components. */
export async function loadAdminInvitationForAcceptPage(tokenHash: string): Promise<
  | {
      emailNormalized: string;
      expired: boolean;
    }
  | null
> {
  const invite = await prisma.adminInvitation.findUnique({
    where: { tokenHash },
    select: {
      emailNormalized: true,
      expiresAt: true,
      consumedAt: true,
      revokedAt: true,
    },
  });

  if (!invite || invite.revokedAt || invite.consumedAt) return null;

  const expired = invite.expiresAt.getTime() <= Date.now();

  return {
    emailNormalized: invite.emailNormalized,
    expired,
  };
}
