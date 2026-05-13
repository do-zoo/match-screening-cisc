import { prisma } from "@/lib/db/prisma";

export async function findDuplicateMemberNumbers(
  eventId: string,
  candidates: string[],
): Promise<string[]> {
  const nums = [...new Set(candidates.filter(Boolean))];
  if (nums.length === 0) return [];

  const [fromTickets, fromRegistrations] = await Promise.all([
    prisma.ticket.findMany({
      where: { eventId, memberNumber: { in: nums } },
      select: { memberNumber: true },
    }),
    prisma.registration.findMany({
      where: { eventId, claimedMemberNumber: { in: nums } },
      select: { claimedMemberNumber: true },
    }),
  ]);

  const set = new Set<string>();
  for (const t of fromTickets) {
    if (t.memberNumber) set.add(t.memberNumber);
  }
  for (const r of fromRegistrations) {
    if (r.claimedMemberNumber) set.add(r.claimedMemberNumber);
  }
  return nums.filter((n) => set.has(n));
}
