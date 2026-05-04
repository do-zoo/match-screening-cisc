import { notFound } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

export default async function CommitteeGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) {
    notFound();
  }
  return <>{children}</>;
}
