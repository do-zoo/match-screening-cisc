import { AdminAccountPageClient } from "@/components/admin/admin-account-page-client";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function AdminAccountPage() {
  const session = await requireAdminSession();

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });

  return (
    <main className="flex flex-1 flex-col">
      <AdminAccountPageClient
        initialName={session.user.name ?? ""}
        email={session.user.email ?? ""}
        initialTwoFactorEnabled={Boolean(dbUser?.twoFactorEnabled)}
      />
    </main>
  );
}
