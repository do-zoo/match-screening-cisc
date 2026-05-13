import { prisma } from "@/lib/db/prisma";
import type { AdminContext } from "@/lib/permissions/guards";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";

/** PIC acara atau Owner/Admin operasional boleh mengelola bukti penutupan keuangan. */
export async function assertCanManageEventSettlement(
  eventId: string,
  ctx: AdminContext,
): Promise<{ picAdminProfileId: string }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { picAdminProfileId: true },
  });
  if (!event) throw new Error("FORBIDDEN");
  const isPic = ctx.profileId === event.picAdminProfileId;
  const isOps = hasOperationalOwnerParity(ctx.role);
  if (!isPic && !isOps) throw new Error("FORBIDDEN");
  return { picAdminProfileId: event.picAdminProfileId };
}
