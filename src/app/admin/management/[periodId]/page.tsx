import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";

export default async function AdminManagementPeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const { periodId } = await params;

  const period = await prisma.boardPeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      label: true,
      startsAt: true,
      endsAt: true,
      assignments: {
        include: {
          managementMember: {
            select: { fullName: true, publicCode: true, masterMemberId: true },
          },
          boardRole: { select: { title: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!period) notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <Link
            href="/admin/management"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Kepengurusan
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {period.label}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {period.startsAt.toISOString().slice(0, 10)} →{" "}
            {period.endsAt.toISOString().slice(0, 10)}
          </p>
        </div>
      </div>

      <section className="rounded-lg border">
        <h2 className="border-b px-4 py-3 text-sm font-medium">
          Penugasan ({period.assignments.length})
        </h2>
        {period.assignments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Belum ada penugasan. Gunakan server actions (`createBoardAssignment`,
            dll.) dari UI yang akan dilengkapi; data dapat diisi lewat Prisma
            Studio sementara.
          </p>
        ) : (
          <ul className="divide-y">
            {period.assignments.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between"
              >
                <span className="font-medium">{a.boardRole.title}</span>
                <span className="text-sm text-muted-foreground">
                  {a.managementMember.fullName}{" "}
                  <span className="font-mono">
                    ({a.managementMember.publicCode})
                  </span>
                  {a.managementMember.masterMemberId ? (
                    <span className="ml-2 text-xs">· tertaut direktori</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
