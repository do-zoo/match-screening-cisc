import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { VenueCatalogEditor } from "@/components/admin/venues/venue-catalog-editor";
import { buttonVariants } from "@/components/ui/button";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { VenueCatalogUiPayload } from "@/lib/forms/venue-catalog-form-schema";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ venueId: string }>;
}): Promise<Metadata> {
  const { venueId } = await params;
  const v = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { name: true },
  });
  return { title: v ? `Edit · ${v.name}` : "Edit venue" };
}

export default async function AdminEditVenuePage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) notFound();

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      name: true,
      address: true,
      menuItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          sortOrder: true,
          voucherEligible: true,
        },
      },
    },
  });

  if (!venue) notFound();

  const initial: VenueCatalogUiPayload = {
    name: venue.name,
    address: venue.address,
    items: venue.menuItems.map((m) => ({
      id: m.id,
      name: m.name,
      price: m.price,
      sortOrder: m.sortOrder,
      voucherEligible: m.voucherEligible,
    })),
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8 lg:py-10">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/venues"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-0")}
        >
          ← Daftar venue
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Kelola venue</h1>
        <p className="text-muted-foreground text-sm">
          Perbarui lokasi beserta menu kanonik. Perubahan harga/nama item yang dikunci akan ditolak bila ada pendaftar.
        </p>
      </div>

      <VenueCatalogEditor venueId={venue.id} initial={initial} />
    </main>
  );
}
