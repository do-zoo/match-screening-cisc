import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Venue" };

export default async function AdminVenuesPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      isActive: true,
      _count: { select: { menuItems: true, events: true } },
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Venue</h1>
          <p className="text-muted-foreground text-sm">
            Katalog lokasi beserta menu kanonik. Tiap acara memilih subset menu dari venue.
          </p>
        </div>
        <Link
          href="/admin/venues/new"
          className={cn(buttonVariants(), "shrink-0")}
        >
          Venue baru
        </Link>
      </div>

      <ul className="divide-border rounded-lg border">
        {venues.length === 0 ? (
          <li className="text-muted-foreground p-4 text-sm">
            Belum ada venue. Buat pertama lewat formulir Venue baru (menu bisa ditambahkan di sana).
          </li>
        ) : (
          venues.map((v) => (
            <li
              key={v.id}
              className="hover:bg-accent/40 flex flex-col gap-1 border-b p-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="font-medium">{v.name}</strong>
                {!v.isActive ? (
                  <span className="text-muted-foreground text-xs">
                    Tidak aktif
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {v.address}
              </p>
              <p className="text-muted-foreground text-xs">
                {v._count.menuItems} menu · digunakan {v._count.events} acara
              </p>
              <Link
                href={`/admin/venues/${v.id}/edit`}
                className="text-xs font-medium underline-offset-4 hover:underline"
              >
                Ubah venue & menu
              </Link>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
