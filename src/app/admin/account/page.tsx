import { AdminAccountPageClient } from "@/components/admin/admin-account-page-client";
import { requireAdminSession } from "@/lib/auth/session";

export default async function AdminAccountPage() {
  const session = await requireAdminSession();

  return (
    <main className="flex flex-1 flex-col">
      <AdminAccountPageClient
        initialName={session.user.name ?? ""}
        email={session.user.email ?? ""}
      />
    </main>
  );
}
