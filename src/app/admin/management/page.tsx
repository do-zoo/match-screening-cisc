import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";
import { findActiveBoardPeriod } from "@/lib/management/active-period";
import { ManagementHubPage } from "@/components/admin/management-hub-page";

export default async function AdminManagementPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const periods = await prisma.boardPeriod.findMany({
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      label: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { assignments: true } },
    },
  });

  const activePeriod = findActiveBoardPeriod(periods, new Date());

  return (
    <ManagementHubPage
      periods={periods.map((p) => ({
        id: p.id,
        label: p.label,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        assignmentCount: p._count.assignments,
      }))}
      activePeriodId={activePeriod?.id ?? null}
    />
  );
}
