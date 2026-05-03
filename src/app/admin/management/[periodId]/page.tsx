import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import {
  countPeriodAssignmentsByTabForAdmin,
  countPeriodAssignmentsForAdmin,
  listPeriodAssignmentsForAdmin,
  type PeriodAssignmentAdminFilter,
} from "@/lib/management/query-admin-period-assignments";
import { findActiveBoardPeriod } from "@/lib/management/active-period";
import { listPeriodRolesAsTree } from "@/lib/management/query-admin-period-tree";
import {
  ADMIN_TABLE_PAGE_SIZE,
  parseAdminTablePage,
  resolveClampedPage,
} from "@/lib/table/admin-pagination";
import { prisma } from "@/lib/db/prisma";
import { ManagementPeriodDetail } from "@/components/admin/management-period-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ periodId: string }>;
}): Promise<Metadata> {
  const { periodId } = await params;
  const period = await prisma.boardPeriod.findUnique({
    where: { id: periodId },
    select: { label: true },
  });
  return { title: period ? `Periode ${period.label}` : "Periode Kepengurusan" };
}

function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined;
  if (Array.isArray(param)) return param[0];
  return param;
}

function parseFilter(v: string | undefined): PeriodAssignmentAdminFilter {
  if (v === "linked" || v === "unlinked") return v;
  return "all";
}

export default async function AdminManagementPeriodPage({
  params,
  searchParams,
}: {
  params: Promise<{ periodId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const { periodId } = await params;

  const period = await prisma.boardPeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      label: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!period) notFound();

  const sp = (await searchParams) ?? {};
  const filter = parseFilter(firstString(sp.filter));
  const qRaw = firstString(sp.q) ?? "";
  const q = qRaw.trim().slice(0, 200) || undefined;
  const viewRaw = firstString(sp.view);
  const view: "list" | "tree" = viewRaw === "tree" ? "tree" : "list";

  const requestedPage = parseAdminTablePage(sp.page);

  const totalItems = await countPeriodAssignmentsForAdmin({
    boardPeriodId: periodId,
    filter,
    q,
  });
  const page = resolveClampedPage(
    requestedPage,
    totalItems,
    ADMIN_TABLE_PAGE_SIZE,
  );
  const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE;

  const [
    assignments,
    availableMembers,
    availableRoles,
    allPeriods,
    tabCounts,
    assignmentsInPeriod,
    treeRows,
  ] =
    await Promise.all([
      listPeriodAssignmentsForAdmin({
        boardPeriodId: periodId,
        filter,
        q,
        skip,
        take: ADMIN_TABLE_PAGE_SIZE,
      }),
      prisma.managementMember.findMany({
        select: { id: true, fullName: true, publicCode: true },
        orderBy: { fullName: "asc" },
      }),
      prisma.boardRole.findMany({
        where: { isActive: true },
        select: { id: true, title: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.boardPeriod.findMany({
        select: { id: true, startsAt: true, endsAt: true },
      }),
      countPeriodAssignmentsByTabForAdmin({ boardPeriodId: periodId, q }),
      prisma.boardAssignment.count({ where: { boardPeriodId: periodId } }),
      view === "tree" ? listPeriodRolesAsTree(periodId) : Promise.resolve([]),
    ]);

  const activePeriod = findActiveBoardPeriod(allPeriods, new Date());

  return (
    <ManagementPeriodDetail
      period={{
        id: period.id,
        label: period.label,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
      }}
      assignments={assignments}
      assignmentsEmpty={assignmentsInPeriod === 0}
      availableMembers={availableMembers}
      availableRoles={availableRoles}
      isActive={activePeriod?.id === period.id}
      pagination={{
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        totalItems,
      }}
      filter={filter}
      searchQuery={q ?? ""}
      tabCounts={tabCounts}
      view={view}
      treeRows={treeRows}
    />
  );
}
