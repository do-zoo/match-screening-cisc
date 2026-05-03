import { prisma } from "@/lib/db/prisma";

export type CommitteeAdminDirectoryRowVm = {
  adminProfileId: string;
  authUserId: string;
  email: string;
  displayName: string;
  role: string;
  managementMemberId: string | null;
  memberSummary: string | null;
  twoFactorEnabled: boolean;
  lastSessionActivityAtIso: string | null;
};

export type CommitteeAdminDirectoryVm = {
  rows: CommitteeAdminDirectoryRowVm[];
  memberOptions: { id: string; label: string }[];
};

export async function loadCommitteeAdminDirectory(): Promise<CommitteeAdminDirectoryVm> {
  const now = new Date();

  const [profiles, memberOptionsRaw] = await Promise.all([
    prisma.adminProfile.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        authUserId: true,
        role: true,
        managementMemberId: true,
        managementMember: {
          select: { publicCode: true, fullName: true },
        },
      },
    }),
    prisma.managementMember.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, publicCode: true, fullName: true },
    }),
  ]);

  const userIds = profiles.map((p) => p.authUserId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      name: true,
      twoFactorEnabled: true,
    },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const sessions = await prisma.session.findMany({
    where: {
      userId: { in: userIds },
      expiresAt: { gt: now },
    },
    select: { userId: true, updatedAt: true },
  });

  const lastSessionByUser = new Map<string, Date>();
  for (const s of sessions) {
    const prev = lastSessionByUser.get(s.userId);
    if (!prev || s.updatedAt > prev) {
      lastSessionByUser.set(s.userId, s.updatedAt);
    }
  }

  const rows: CommitteeAdminDirectoryRowVm[] = profiles.map((p) => {
    const u = userById.get(p.authUserId);
    const last = lastSessionByUser.get(p.authUserId);
    return {
      adminProfileId: p.id,
      authUserId: p.authUserId,
      email: u?.email ?? p.authUserId,
      displayName: u?.name ?? "—",
      role: p.role,
      managementMemberId: p.managementMemberId,
      memberSummary: p.managementMember
        ? `${p.managementMember.publicCode} — ${p.managementMember.fullName}`
        : null,
      twoFactorEnabled: Boolean(u?.twoFactorEnabled),
      lastSessionActivityAtIso: last ? last.toISOString() : null,
    };
  });

  const memberOptions = memberOptionsRaw.map((m) => ({
    id: m.id,
    label: `${m.publicCode} — ${m.fullName}`,
  }));

  return { rows, memberOptions };
}
