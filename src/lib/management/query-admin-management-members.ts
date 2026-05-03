import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ManagementMemberAdminFilter = "all" | "linked" | "unlinked";

export type AdminManagementMemberRowVm = {
  id: string;
  fullName: string;
  publicCode: string;
  whatsapp: string | null;
  masterMemberId: string | null;
  masterMember: { memberNumber: string } | null;
};

function trimmedSearch(q: string | undefined): string | undefined {
  const t = q?.trim();
  if (!t) return undefined;
  return t.slice(0, 200);
}

function managementMemberSearchOnlyWhere(
  q?: string,
): Prisma.ManagementMemberWhereInput {
  const search = trimmedSearch(q);
  if (search === undefined) return {};
  return {
    OR: [
      { fullName: { contains: search, mode: "insensitive" } },
      { publicCode: { contains: search, mode: "insensitive" } },
      { whatsapp: { contains: search, mode: "insensitive" } },
    ],
  };
}

/** Where for list/count with filter + optional search (`q`). */
export function managementMemberAdminWhere(opts: {
  filter: ManagementMemberAdminFilter;
  q?: string;
}): Prisma.ManagementMemberWhereInput {
  const searchClause = managementMemberSearchOnlyWhere(opts.q);
  const linkClause: Prisma.ManagementMemberWhereInput =
    opts.filter === "linked"
      ? { masterMemberId: { not: null } }
      : opts.filter === "unlinked"
        ? { masterMemberId: null }
        : {};

  return { AND: [linkClause, searchClause] };
}

/** Row counts per tab for current search text (same semantics as direktori anggota). */
export async function countManagementMembersByTabForAdmin(opts: {
  q?: string;
}): Promise<{ all: number; linked: number; unlinked: number }> {
  const searchOnly = managementMemberSearchOnlyWhere(opts.q);
  const hasSearch = Object.keys(searchOnly).length > 0;

  const [all, linked, unlinked] = await Promise.all([
    prisma.managementMember.count({
      ...(hasSearch ? { where: searchOnly } : {}),
    }),
    prisma.managementMember.count({
      where: hasSearch
        ? { AND: [searchOnly, { masterMemberId: { not: null } }] }
        : { masterMemberId: { not: null } },
    }),
    prisma.managementMember.count({
      where: hasSearch
        ? { AND: [searchOnly, { masterMemberId: null }] }
        : { masterMemberId: null },
    }),
  ]);

  return { all, linked, unlinked };
}

export async function countManagementMembersForAdmin(opts: {
  filter: ManagementMemberAdminFilter;
  q?: string;
}): Promise<number> {
  return prisma.managementMember.count({
    where: managementMemberAdminWhere(opts),
  });
}

function mapManagementMemberRow(row: {
  id: string;
  fullName: string;
  publicCode: string;
  whatsapp: string | null;
  masterMemberId: string | null;
  masterMember: { memberNumber: string } | null;
}): AdminManagementMemberRowVm {
  return { ...row };
}

export async function listManagementMembersForAdmin(opts: {
  filter: ManagementMemberAdminFilter;
  q?: string;
  skip: number;
  take: number;
}): Promise<AdminManagementMemberRowVm[]> {
  const rows = await prisma.managementMember.findMany({
    where: managementMemberAdminWhere(opts),
    include: { masterMember: { select: { memberNumber: true } } },
    orderBy: { fullName: "asc" },
    skip: opts.skip,
    take: opts.take,
  });

  return rows.map(mapManagementMemberRow);
}
