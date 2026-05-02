import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type AdminMasterMemberRowVm = {
  id: string;
  memberNumber: string;
  fullName: string;
  whatsapp: string | null;
  isActive: boolean;
  isManagementMember: boolean;
  updatedAt: string;
};

function trimmedSearch(q: string | undefined): string | undefined {
  const t = q?.trim();
  if (!t) return undefined;
  return t.slice(0, 200);
}

export function masterMemberAdminWhere(opts: {
  filter: "all" | "active" | "inactive";
  q?: string;
}): Prisma.MasterMemberWhereInput {
  const search = trimmedSearch(opts.q);
  const searchClause: Prisma.MasterMemberWhereInput =
    search === undefined
      ? {}
      : {
          OR: [
            { memberNumber: { contains: search, mode: "insensitive" } },
            { fullName: { contains: search, mode: "insensitive" } },
            {
              whatsapp: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        };

  const activityClause: Prisma.MasterMemberWhereInput =
    opts.filter === "active"
      ? { isActive: true }
      : opts.filter === "inactive"
        ? { isActive: false }
        : {};

  return { AND: [activityClause, searchClause] };
}

/** Search clause only — for tab totals while a filter chip is applied. */
function masterMemberSearchOnlyWhere(q?: string): Prisma.MasterMemberWhereInput {
  const search = trimmedSearch(q);
  if (search === undefined) return {};
  return {
    OR: [
      { memberNumber: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
      { whatsapp: { contains: search, mode: "insensitive" } },
    ],
  };
}

function mapMasterMemberRow(row: {
  id: string;
  memberNumber: string;
  fullName: string;
  whatsapp: string | null;
  isActive: boolean;
  isManagementMember: boolean;
  updatedAt: Date;
}): AdminMasterMemberRowVm {
  return {
    id: row.id,
    memberNumber: row.memberNumber,
    fullName: row.fullName,
    whatsapp: row.whatsapp,
    isActive: row.isActive,
    isManagementMember: row.isManagementMember,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Row counts per activity tab for the current search text (matches previous client semantics). */
export async function countMasterMembersByTabForAdmin(opts: {
  q?: string;
}): Promise<{ all: number; active: number; inactive: number }> {
  const searchOnly = masterMemberSearchOnlyWhere(opts.q);
  const hasSearch = Object.keys(searchOnly).length > 0;

  const [all, active, inactive] = await Promise.all([
    prisma.masterMember.count({
      ...(hasSearch ? { where: searchOnly } : {}),
    }),
    prisma.masterMember.count({
      where: hasSearch
        ? { AND: [searchOnly, { isActive: true }] }
        : { isActive: true },
    }),
    prisma.masterMember.count({
      where: hasSearch
        ? { AND: [searchOnly, { isActive: false }] }
        : { isActive: false },
    }),
  ]);

  return { all, active, inactive };
}

export async function countMasterMembersForAdmin(opts: {
  q?: string;
  filter: "all" | "active" | "inactive";
}): Promise<number> {
  return prisma.masterMember.count({
    where: masterMemberAdminWhere(opts),
  });
}

export async function listMasterMembersForAdmin(opts: {
  q?: string;
  filter: "all" | "active" | "inactive";
  skip?: number;
  take?: number;
}): Promise<AdminMasterMemberRowVm[]> {
  const rows = await prisma.masterMember.findMany({
    where: masterMemberAdminWhere(opts),
    orderBy: { updatedAt: "desc" },
    ...(opts.skip !== undefined && opts.take !== undefined
      ? { skip: opts.skip, take: opts.take }
      : {}),
  });

  return rows.map(mapMasterMemberRow);
}
