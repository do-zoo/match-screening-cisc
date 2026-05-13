import { prisma } from "@/lib/db/prisma";

export async function findDuplicateMemberNumbers(
  eventId: string,
  candidates: string[],
): Promise<string[]> {
  const nums = [...new Set(candidates.filter(Boolean))];
  if (nums.length === 0) return [];

  const fromRegistrations = await prisma.registration.findMany({
    where: { eventId, claimedMemberNumber: { in: nums } },
    select: { claimedMemberNumber: true },
  });

  const set = new Set<string>();
  for (const r of fromRegistrations) {
    if (r.claimedMemberNumber) set.add(r.claimedMemberNumber);
  }
  return nums.filter((n) => set.has(n));
}
