import { prisma } from "@/lib/db/prisma";

/**
 * Active directory row for a member number, or null if unknown/inactive.
 * Used by registration submit and public partner-eligibility lookup.
 */
export async function getActiveMasterMemberByMemberNumber(
  memberNumber: string,
): Promise<{ isPengurus: boolean } | null> {
  const trimmed = memberNumber.trim();
  if (!trimmed) return null;

  return prisma.masterMember.findFirst({
    where: { memberNumber: trimmed, isActive: true },
    select: { isPengurus: true },
  });
}
