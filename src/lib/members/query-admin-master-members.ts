import { prisma } from "@/lib/db/prisma";

export type AdminMasterMemberRowVm = {
  id: string;
  memberNumber: string;
  fullName: string;
  whatsapp: string | null;
  isActive: boolean;
  isPengurus: boolean;
  canBePIC: boolean;
  updatedAt: string;
};

export async function listMasterMembersForAdmin(opts: {
  q?: string;
  filter: "all" | "active" | "inactive";
}): Promise<AdminMasterMemberRowVm[]> {
  const search = opts.q?.trim();
  const rows = await prisma.masterMember.findMany({
    where: {
      AND: [
        opts.filter === "active" ? { isActive: true } : {},
        opts.filter === "inactive" ? { isActive: false } : {},
        search
          ? {
              OR: [
                { memberNumber: { contains: search, mode: "insensitive" } },
                { fullName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  return rows.map((row) => ({
    id: row.id,
    memberNumber: row.memberNumber,
    fullName: row.fullName,
    whatsapp: row.whatsapp,
    isActive: row.isActive,
    isPengurus: row.isPengurus,
    canBePIC: row.canBePIC,
    updatedAt: row.updatedAt.toISOString(),
  }));
}
