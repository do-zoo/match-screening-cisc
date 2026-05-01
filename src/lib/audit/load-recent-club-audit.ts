import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export type ClubAuditRowVm = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAtIso: string;
  actorAuthUserId: string;
};

export const loadRecentClubAuditForOwnerSettings = cache(
  async (): Promise<ClubAuditRowVm[]> => {
    const rows = await prisma.clubAuditLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actorAuthUserId: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata,
      createdAtIso: r.createdAt.toISOString(),
      actorAuthUserId: r.actorAuthUserId,
    }));
  },
);
