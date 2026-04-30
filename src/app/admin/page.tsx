import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function AdminHomePage() {
  const session = await getAdminSession();
  const authUserId = session?.user?.id ?? null;

  const admin = authUserId
    ? await prisma.adminProfile.findUnique({ where: { authUserId } })
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Authenticated as <span className="font-mono">{session?.user?.email}</span>
      </p>
      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm">
          <div>
            <span className="text-zinc-500">Role:</span>{" "}
            <span className="font-mono">{admin?.role ?? "UNKNOWN (no AdminProfile)"}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
