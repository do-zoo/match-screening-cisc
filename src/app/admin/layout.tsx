import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminAppShell } from "@/components/admin/admin-app-shell";
import { getAdminContext } from "@/lib/auth/admin-context";
import { deriveGlobalSidebarNav } from "@/lib/admin/global-nav-flags";
import { getAdminSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s — Admin | CISC",
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/sign-in");
  }

  const adminCtx = await getAdminContext(session.user.id);
  const navFlags = deriveGlobalSidebarNav(adminCtx);

  return (
    <AdminAppShell
      navFlags={navFlags}
      userEmail={session.user.email ?? null}
      displayName={session.user.name ?? null}
    >
      {children}
    </AdminAppShell>
  );
}
