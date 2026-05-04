import type { EventStatus } from "@prisma/client";

import type { CommitteeAdminDirectoryPicBankVm } from "@/lib/admin/load-committee-admin-directory";
import { prisma } from "@/lib/db/prisma";

export type EventAsPicVm = {
  eventId: string;
  name: string;
  startAtIso: string;
  status: EventStatus;
};

export type CommitteeAdminDetailVm = {
  adminProfileId: string;
  authUserId: string;
  email: string;
  displayName: string;
  role: string;
  managementMemberId: string | null;
  memberSummary: string | null;
  twoFactorEnabled: boolean;
  lastSessionActivityAtIso: string | null;
  picBankAccounts: CommitteeAdminDirectoryPicBankVm[];
  eventsAsPic: EventAsPicVm[];
  memberOptions: { id: string; label: string }[];
};

export async function loadCommitteeAdminDetail(
  adminProfileId: string,
): Promise<CommitteeAdminDetailVm | null> {
  const now = new Date();

  const [profile, memberOptionsRaw, eventsRaw] = await Promise.all([
    prisma.adminProfile.findUnique({
      where: { id: adminProfileId },
      select: {
        id: true,
        authUserId: true,
        role: true,
        managementMemberId: true,
        managementMember: {
          select: { publicCode: true, fullName: true },
        },
        ownedPicBankAccounts: {
          orderBy: { bankName: "asc" },
          select: {
            id: true,
            bankName: true,
            accountNumber: true,
            accountName: true,
            isActive: true,
          },
        },
      },
    }),
    prisma.managementMember.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, publicCode: true, fullName: true },
    }),
    prisma.event.findMany({
      where: { picAdminProfileId: adminProfileId },
      orderBy: { startAt: "desc" },
      select: { id: true, title: true, startAt: true, status: true },
    }),
  ]);

  if (!profile) return null;

  const [user, lastSession] = await Promise.all([
    prisma.user.findUnique({
      where: { id: profile.authUserId },
      select: { email: true, name: true, twoFactorEnabled: true },
    }),
    prisma.session.findFirst({
      where: { userId: profile.authUserId, expiresAt: { gt: now } },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  return {
    adminProfileId: profile.id,
    authUserId: profile.authUserId,
    email: user?.email ?? profile.authUserId,
    displayName: user?.name ?? "—",
    role: profile.role,
    managementMemberId: profile.managementMemberId,
    memberSummary: profile.managementMember
      ? `${profile.managementMember.publicCode} — ${profile.managementMember.fullName}`
      : null,
    twoFactorEnabled: Boolean(user?.twoFactorEnabled),
    lastSessionActivityAtIso: lastSession ? lastSession.updatedAt.toISOString() : null,
    picBankAccounts: profile.ownedPicBankAccounts,
    eventsAsPic: eventsRaw.map((e) => ({
      eventId: e.id,
      name: e.title,
      startAtIso: e.startAt.toISOString(),
      status: e.status,
    })),
    memberOptions: memberOptionsRaw.map((m) => ({
      id: m.id,
      label: `${m.publicCode} — ${m.fullName}`,
    })),
  };
}
