import { prisma } from "@/lib/db/prisma";

/**
 * Active directory row for a member number, or null if unknown/inactive.
 * Used by registration submit and public partner-eligibility lookup.
 */
export type ActiveMasterMemberRow = {
  /** Nilai persis di kolom DB (sumber kanonis untuk penyimpanan & konsistensi direktori). */
  memberNumber: string;
  isPengurus: boolean;
  fullName: string;
  whatsapp: string | null;
};

export async function getActiveMasterMemberByMemberNumber(
  memberNumber: string,
): Promise<ActiveMasterMemberRow | null> {
  const trimmed = memberNumber.trim();
  if (!trimmed) return null;

  return prisma.masterMember.findFirst({
    where: {
      isActive: true,
      memberNumber: {
        equals: trimmed,
        mode: "insensitive",
      },
    },
    select: {
      memberNumber: true,
      isPengurus: true,
      fullName: true,
      whatsapp: true,
    },
  });
}
