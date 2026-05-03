import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Jabatan" };
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";
import { ManagementRolesPage } from "@/components/admin/management-roles-page";

export default async function AdminManagementRolesPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const roles = await prisma.boardRole.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, sortOrder: true, isActive: true },
  });

  return <ManagementRolesPage roles={roles} />;
}
