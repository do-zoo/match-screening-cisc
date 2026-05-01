import { redirect } from "next/navigation";

import { AdminAppShell } from "@/components/admin/admin-app-shell";
import { getAdminSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/sign-in");
  }

  return (
    <AdminAppShell userEmail={session.user.email ?? null}>
      {children}
    </AdminAppShell>
  );
}
