import { prisma } from "@/lib/db/prisma";

export async function findDuplicateMemberNumbers(
  eventId: string,
  candidates: string[],
): Promise<string[]> {
  const nums = [...new Set(candidates.filter(Boolean))];
  if (nums.length === 0) return [];

  const existing = await prisma.ticket.findMany({
    where: { eventId, memberNumber: { in: nums } },
    select: { memberNumber: true },
  });

  const set = new Set(
    existing.map((e) => e.memberNumber).filter(Boolean) as string[],
  );
  return nums.filter((n) => set.has(n));
}
