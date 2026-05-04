import { prisma } from "@/lib/db/prisma";

export type PendingAdminInvitationRowVm = {
  id: string;
  emailNormalized: string;
  role: string;
  expiresAtIso: string;
  createdAtIso: string;
  /** Snapshot at committee page load — refresh untuk memperbarui. */
  isExpired: boolean;
};

export async function loadPendingAdminInvitationsForCommittee(): Promise<
  PendingAdminInvitationRowVm[]
> {
  const rows = await prisma.adminInvitation.findMany({
    where: { consumedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      emailNormalized: true,
      role: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const nowMs = Date.now();

  return rows.map((r) => ({
    id: r.id,
    emailNormalized: r.emailNormalized,
    role: r.role,
    expiresAtIso: r.expiresAt.toISOString(),
    createdAtIso: r.createdAt.toISOString(),
    isExpired: r.expiresAt.getTime() <= nowMs,
  }));
}
