import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Jabatan" };
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import {
  countBoardRolesByTabForAdmin,
  countBoardRolesForAdmin,
  listBoardRolesForAdmin,
  type BoardRoleAdminFilter,
} from "@/lib/management/query-admin-board-roles";
import {
  ADMIN_TABLE_PAGE_SIZE,
  parseAdminTablePage,
  resolveClampedPage,
} from "@/lib/table/admin-pagination";
import { prisma } from "@/lib/db/prisma";
import { ManagementRolesPage } from "@/components/admin/management-roles-page";

function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined;
  if (Array.isArray(param)) return param[0];
  return param;
}

function parseFilter(v: string | undefined): BoardRoleAdminFilter {
  if (v === "active" || v === "inactive") return v;
  return "all";
}

export default async function AdminManagementRolesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const sp = (await searchParams) ?? {};
  const filter = parseFilter(firstString(sp.filter));
  const qRaw = firstString(sp.q) ?? "";
  const q = qRaw.trim().slice(0, 200) || undefined;

  const requestedPage = parseAdminTablePage(sp.page);

  const totalItems = await countBoardRolesForAdmin({ filter, q });
  const page = resolveClampedPage(
    requestedPage,
    totalItems,
    ADMIN_TABLE_PAGE_SIZE,
  );
  const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE;

  const [roles, tabCounts, totalInDb] = await Promise.all([
    listBoardRolesForAdmin({
      filter,
      q,
      skip,
      take: ADMIN_TABLE_PAGE_SIZE,
    }),
    countBoardRolesByTabForAdmin({ q }),
    prisma.boardRole.count(),
  ]);

  return (
    <ManagementRolesPage
      roles={roles}
      directoryEmpty={totalInDb === 0}
      pagination={{
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        totalItems,
      }}
      filter={filter}
      searchQuery={q ?? ""}
      tabCounts={tabCounts}
    />
  );
}
