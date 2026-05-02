import { prisma } from "@/lib/db/prisma";
import { findActiveBoardPeriod } from "@/lib/management/active-period";

export type ResolveManagementMemberResult =
  | { ok: true; managementMemberId: string; fullName: string }
  | { ok: false; reason: "not_found" | "not_assigned" };

/** Validates `publicCode` (already normalized) for an active-period board assignment. */
export async function resolveManagementMemberForPublicRegistration(
  publicCode: string,
): Promise<ResolveManagementMemberResult> {
  const mm = await prisma.managementMember.findUnique({
    where: { publicCode },
    select: { id: true, fullName: true },
  });
  if (!mm) return { ok: false, reason: "not_found" };

  const periods = await prisma.boardPeriod.findMany({
    select: { id: true, startsAt: true, endsAt: true },
  });
  const active = findActiveBoardPeriod(periods, new Date());
  if (!active) return { ok: false, reason: "not_assigned" };

  const assignment = await prisma.boardAssignment.findFirst({
    where: {
      boardPeriodId: active.id,
      managementMemberId: mm.id,
    },
    select: { id: true },
  });
  if (!assignment) return { ok: false, reason: "not_assigned" };

  return {
    ok: true,
    managementMemberId: mm.id,
    fullName: mm.fullName,
  };
}
