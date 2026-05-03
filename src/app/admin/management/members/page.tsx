import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";
import { ManagementMembersPage } from "@/components/admin/management-members-page";

export default async function AdminManagementMembersPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const [members, availableMasterMembers] = await Promise.all([
    prisma.managementMember.findMany({
      include: { masterMember: { select: { memberNumber: true } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.masterMember.findMany({
      where: { isActive: true },
      select: { id: true, memberNumber: true, fullName: true },
      orderBy: { memberNumber: "asc" },
    }),
  ]);

  return (
    <ManagementMembersPage
      members={members}
      availableMasterMembers={availableMasterMembers}
    />
  );
}
