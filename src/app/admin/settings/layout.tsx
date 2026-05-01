import { notFound } from "next/navigation";

import { CommitteeSettingsSubnav } from "@/components/admin/committee-settings-subnav";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

export default async function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 lg:flex-row lg:gap-10 lg:py-10">
      <aside className="lg:w-56 lg:shrink-0 lg:overflow-visible">
        <CommitteeSettingsSubnav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </main>
  );
}
