import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type BoardRoleAdminFilter = "all" | "active" | "inactive";

export type AdminBoardRoleRowVm = {
  id: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
};

function trimmedSearch(q: string | undefined): string | undefined {
  const t = q?.trim();
  if (!t) return undefined;
  return t.slice(0, 200);
}

function boardRoleSearchOnlyWhere(
  q?: string,
): Prisma.BoardRoleWhereInput {
  const search = trimmedSearch(q);
  if (search === undefined) return {};
  return {
    title: { contains: search, mode: "insensitive" },
  };
}

export function boardRoleAdminWhere(opts: {
  filter: BoardRoleAdminFilter;
  q?: string;
}): Prisma.BoardRoleWhereInput {
  const searchClause = boardRoleSearchOnlyWhere(opts.q);
  const activityClause: Prisma.BoardRoleWhereInput =
    opts.filter === "active"
      ? { isActive: true }
      : opts.filter === "inactive"
        ? { isActive: false }
        : {};

  return { AND: [activityClause, searchClause] };
}

export async function countBoardRolesByTabForAdmin(opts: {
  q?: string;
}): Promise<{ all: number; active: number; inactive: number }> {
  const searchOnly = boardRoleSearchOnlyWhere(opts.q);
  const hasSearch = Object.keys(searchOnly).length > 0;

  const [all, active, inactive] = await Promise.all([
    prisma.boardRole.count({
      ...(hasSearch ? { where: searchOnly } : {}),
    }),
    prisma.boardRole.count({
      where: hasSearch
        ? { AND: [searchOnly, { isActive: true }] }
        : { isActive: true },
    }),
    prisma.boardRole.count({
      where: hasSearch
        ? { AND: [searchOnly, { isActive: false }] }
        : { isActive: false },
    }),
  ]);

  return { all, active, inactive };
}

export async function countBoardRolesForAdmin(opts: {
  filter: BoardRoleAdminFilter;
  q?: string;
}): Promise<number> {
  return prisma.boardRole.count({
    where: boardRoleAdminWhere(opts),
  });
}

export async function listBoardRolesForAdmin(opts: {
  filter: BoardRoleAdminFilter;
  q?: string;
  skip: number;
  take: number;
}): Promise<AdminBoardRoleRowVm[]> {
  return prisma.boardRole.findMany({
    where: boardRoleAdminWhere(opts),
    select: { id: true, title: true, sortOrder: true, isActive: true },
    orderBy: { sortOrder: "asc" },
    skip: opts.skip,
    take: opts.take,
  });
}
