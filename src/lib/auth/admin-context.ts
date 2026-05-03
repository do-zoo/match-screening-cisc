import { prisma } from "@/lib/db/prisma";
import type { AdminContext } from "@/lib/permissions/guards";
import type { AdminRole } from "@/lib/permissions/roles";

export async function getAdminContext(
  authUserId: string,
): Promise<AdminContext | null> {
  const profile = await prisma.adminProfile.findUnique({
    where: { authUserId },
    include: {
      eventsAsHelper: { select: { eventId: true } },
    },
  });
  if (!profile) return null;

  const helperEventIds = profile.eventsAsHelper.map((e) => e.eventId);

  return {
    profileId: profile.id,
    role: profile.role as AdminRole,
    helperEventIds,
  };
}
