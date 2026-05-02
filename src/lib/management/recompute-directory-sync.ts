import type { Prisma } from "@prisma/client";

import { findActiveBoardPeriod } from "@/lib/management/active-period";
import {
  computeIsManagementMemberForMember,
  type BoardAssignmentRow,
} from "@/lib/management/recompute-directory-flags";

/** Updates `isManagementMember` for the given directory ids from active-period assignments. */
export async function recomputeDirectoryManagementFlagsTx(
  tx: Prisma.TransactionClient,
  seedMasterMemberIds: string[],
): Promise<void> {
  const ids = [...new Set(seedMasterMemberIds)].filter(Boolean);
  if (ids.length === 0) return;

  const periods = await tx.boardPeriod.findMany({
    select: { id: true, startsAt: true, endsAt: true },
  });
  const now = new Date();
  const active = findActiveBoardPeriod(periods, now);

  const assignmentsRaw = active
    ? await tx.boardAssignment.findMany({
        where: { boardPeriodId: active.id },
        select: {
          boardPeriodId: true,
          managementMemberId: true,
          managementMember: { select: { masterMemberId: true } },
        },
      })
    : [];

  const rows: BoardAssignmentRow[] = assignmentsRaw.map((a) => ({
    boardPeriodId: a.boardPeriodId,
    managementMemberId: a.managementMemberId,
    masterMemberId: a.managementMember.masterMemberId,
  }));

  for (const masterMemberId of ids) {
    const next = computeIsManagementMemberForMember({
      masterMemberId,
      activePeriodId: active?.id ?? null,
      assignments: rows,
    });
    await tx.masterMember.update({
      where: { id: masterMemberId },
      data: { isManagementMember: next },
    });
  }
}

/** Recompute every directory row linked from a `ManagementMember` (e.g. after period boundary changes). */
export async function recomputeAllLinkedDirectoryFlagsTx(
  tx: Prisma.TransactionClient,
): Promise<void> {
  const links = await tx.managementMember.findMany({
    where: { masterMemberId: { not: null } },
    select: { masterMemberId: true },
  });
  const ids = links
    .map((l) => l.masterMemberId)
    .filter((id): id is string => id !== null);
  await recomputeDirectoryManagementFlagsTx(tx, ids);
}
