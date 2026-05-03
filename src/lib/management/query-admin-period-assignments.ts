import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

/** Filter by tautan pengurus ke direktori anggota (MasterMember). */
export type PeriodAssignmentAdminFilter = "all" | "linked" | "unlinked";

export type AdminPeriodAssignmentRowVm = {
  id: string;
  boardRole: { id: string; title: string };
  managementMember: {
    id: string;
    fullName: string;
    publicCode: string;
    masterMemberId: string | null;
  };
};

function trimmedSearch(q: string | undefined): string | undefined {
  const t = q?.trim();
  if (!t) return undefined;
  return t.slice(0, 200);
}

function assignmentSearchClause(
  q?: string,
): Prisma.BoardAssignmentWhereInput {
  const search = trimmedSearch(q);
  if (search === undefined) return {};
  return {
    OR: [
      { boardRole: { title: { contains: search, mode: "insensitive" } } },
      {
        managementMember: {
          fullName: { contains: search, mode: "insensitive" },
        },
      },
      {
        managementMember: {
          publicCode: { contains: search, mode: "insensitive" },
        },
      },
    ],
  };
}

/** Direktori: punya tautan MasterMember atau belum (null masterMemberId pada ManagementMember). */
export function boardAssignmentAdminWhere(opts: {
  boardPeriodId: string;
  filter: PeriodAssignmentAdminFilter;
  q?: string;
}): Prisma.BoardAssignmentWhereInput {
  const linkClause: Prisma.BoardAssignmentWhereInput =
    opts.filter === "linked"
      ? { managementMember: { masterMemberId: { not: null } } }
      : opts.filter === "unlinked"
        ? { managementMember: { masterMemberId: null } }
        : {};
  const searchClause = assignmentSearchClause(opts.q);

  return {
    AND: [
      { boardPeriodId: opts.boardPeriodId },
      ...(Object.keys(linkClause).length ? [linkClause] : []),
      ...(Object.keys(searchClause).length ? [searchClause] : []),
    ],
  };
}

export async function countPeriodAssignmentsByTabForAdmin(opts: {
  boardPeriodId: string;
  q?: string;
}): Promise<{ all: number; linked: number; unlinked: number }> {
  const searchOnly = assignmentSearchClause(opts.q);
  const hasSearch = Object.keys(searchOnly).length > 0;
  const base = { boardPeriodId: opts.boardPeriodId } as const;

  const [all, linked, unlinked] = await Promise.all([
    prisma.boardAssignment.count({
      where: {
        ...base,
        ...(hasSearch ? searchOnly : {}),
      },
    }),
    prisma.boardAssignment.count({
      where: {
        AND: [
          base,
          { managementMember: { masterMemberId: { not: null } } },
          ...(hasSearch ? [searchOnly] : []),
        ],
      },
    }),
    prisma.boardAssignment.count({
      where: {
        AND: [
          base,
          { managementMember: { masterMemberId: null } },
          ...(hasSearch ? [searchOnly] : []),
        ],
      },
    }),
  ]);

  return { all, linked, unlinked };
}

export async function countPeriodAssignmentsForAdmin(opts: {
  boardPeriodId: string;
  filter: PeriodAssignmentAdminFilter;
  q?: string;
}): Promise<number> {
  return prisma.boardAssignment.count({
    where: boardAssignmentAdminWhere(opts),
  });
}

export async function listPeriodAssignmentsForAdmin(opts: {
  boardPeriodId: string;
  filter: PeriodAssignmentAdminFilter;
  q?: string;
  skip: number;
  take: number;
}): Promise<AdminPeriodAssignmentRowVm[]> {
  const rows = await prisma.boardAssignment.findMany({
    where: boardAssignmentAdminWhere(opts),
    include: {
      managementMember: {
        select: {
          id: true,
          fullName: true,
          publicCode: true,
          masterMemberId: true,
        },
      },
      boardRole: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "asc" },
    skip: opts.skip,
    take: opts.take,
  });

  return rows.map((r) => ({
    id: r.id,
    boardRole: r.boardRole,
    managementMember: r.managementMember,
  }));
}
