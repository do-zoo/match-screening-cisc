import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";
import { findActiveBoardPeriod } from "@/lib/management/active-period";
import { ManagementPeriodDetail } from "@/components/admin/management-period-detail";

export default async function AdminManagementPeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const { periodId } = await params;

  const [period, availableMembers, availableRoles, allPeriods] =
    await Promise.all([
      prisma.boardPeriod.findUnique({
        where: { id: periodId },
        select: {
          id: true,
          label: true,
          startsAt: true,
          endsAt: true,
          assignments: {
            include: {
              managementMember: {
                select: { id: true, fullName: true, publicCode: true, masterMemberId: true },
              },
              boardRole: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
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
    ]);

  if (!period) notFound();

  const activePeriod = findActiveBoardPeriod(allPeriods, new Date());

  return (
    <ManagementPeriodDetail
      period={{
        id: period.id,
        label: period.label,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
      }}
      assignments={period.assignments}
      availableMembers={availableMembers}
      availableRoles={availableRoles}
      isActive={activePeriod?.id === period.id}
    />
  );
}
