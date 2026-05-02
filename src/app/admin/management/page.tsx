import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";

export default async function AdminManagementPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const periods = await prisma.boardPeriod.findMany({
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      label: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { assignments: true } },
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kepengurusan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Periode kabinet dan penugasan jabatan. Tambahkan periode dan pengurus
          dari halaman detail periode.
        </p>
      </div>
      {periods.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada periode. Buat periode pertama dari detail (tombol akan
          ditambahkan di langkah berikutnya) atau lewat migrasi data.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {periods.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/management/${p.id}`}
                className="flex flex-col gap-0.5 px-4 py-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium">{p.label}</span>
                <span className="text-xs text-muted-foreground">
                  {p._count.assignments} penugasan ·{" "}
                  {p.startsAt.toISOString().slice(0, 10)} →{" "}
                  {p.endsAt.toISOString().slice(0, 10)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
