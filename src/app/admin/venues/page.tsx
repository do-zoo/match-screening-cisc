import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import type { Prisma } from "@prisma/client";

import { AdminVenuesCardsView } from "@/components/admin/admin-venues-cards-view";
import { AdminVenuesIndexHeader } from "@/components/admin/admin-venues-index-header";
import { AdminVenuesIndexToolbar } from "@/components/admin/admin-venues-index-toolbar";
import { AdminVenuesTable } from "@/components/admin/admin-venues-table";
import {
  parseVenuesIndexTab,
  type VenuesIndexTab,
} from "@/lib/admin/admin-venues-index";
import {
  parseEventsIndexSearchQuery,
  parseEventsIndexViewParam,
} from "@/lib/admin/events-index-view";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import {
  ADMIN_TABLE_PAGE_SIZE,
  parseAdminTablePage,
  resolveClampedPage,
} from "@/lib/table/admin-pagination";

export const metadata: Metadata = { title: "Venue" };

function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined;
  if (Array.isArray(param)) return param[0];
  return param;
}

function tabParamMissing(tabParam: string | string[] | undefined): boolean {
  return (
    tabParam === undefined ||
    tabParam === "" ||
    (Array.isArray(tabParam) && (tabParam.length === 0 || tabParam[0] === ""))
  );
}

function buildVenueWhere(
  tab: VenuesIndexTab,
  q: string,
): Prisma.VenueWhereInput {
  const and: Prisma.VenueWhereInput[] = [];
  if (tab === "active") and.push({ isActive: true });
  if (tab === "inactive") and.push({ isActive: false });
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  return and.length > 0 ? { AND: and } : {};
}

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const sp = (await searchParams) ?? {};
  const viewMode = parseEventsIndexViewParam(sp.view);

  if (tabParamMissing(sp.tab)) {
    const p = new URLSearchParams();
    p.set("tab", "all");
    if (viewMode === "table") p.set("view", "tabel");
    const qEarly = parseEventsIndexSearchQuery(sp.q);
    if (qEarly) p.set("q", qEarly);
    redirect(`/admin/venues?${p.toString()}`);
  }

  const tab = parseVenuesIndexTab(sp.tab);
  const q = parseEventsIndexSearchQuery(sp.q);
  const venueWhere = buildVenueWhere(tab, q);

  const select = {
    id: true,
    name: true,
    address: true,
    isActive: true,
    _count: { select: { menuItems: true, events: true } },
  } as const;

  if (viewMode === "table") {
    const requestedPage = parseAdminTablePage(firstString(sp.page));
    const totalItems = await prisma.venue.count({ where: venueWhere });
    const page = resolveClampedPage(
      requestedPage,
      totalItems,
      ADMIN_TABLE_PAGE_SIZE,
    );
    const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE;

    const rows = await prisma.venue.findMany({
      where: venueWhere,
      orderBy: { name: "asc" },
      skip,
      take: ADMIN_TABLE_PAGE_SIZE,
      select,
    });

    const venueRows = rows.map((v) => ({
      id: v.id,
      name: v.name,
      address: v.address,
      isActive: v.isActive,
      menuItemCount: v._count.menuItems,
      eventCount: v._count.events,
    }));

    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-8 lg:py-10">
        <AdminVenuesIndexHeader />

        <AdminVenuesIndexToolbar
          key={`venues-idx-toolbar-${tab}-table`}
          tab={tab}
          viewMode="table"
          searchQuery={q}
        />

        {totalItems === 0 ? (
          <p className="text-muted-foreground text-sm">
            Belum ada venue untuk filter ini. Buat venue baru lewat tombol Venue
            baru.
          </p>
        ) : (
          <AdminVenuesTable
            pathname="/admin/venues"
            preservedQuery={{
              view: "tabel",
              tab,
              ...(q ? { q } : {}),
            }}
            venues={venueRows}
            pagination={{
              page,
              pageSize: ADMIN_TABLE_PAGE_SIZE,
              totalItems,
            }}
          />
        )}
      </main>
    );
  }

  const requestedPage = parseAdminTablePage(firstString(sp.page));
  const totalItems = await prisma.venue.count({ where: venueWhere });
  const page = resolveClampedPage(
    requestedPage,
    totalItems,
    ADMIN_TABLE_PAGE_SIZE,
  );
  const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE;

  const rows = await prisma.venue.findMany({
    where: venueWhere,
    orderBy: { name: "asc" },
    skip,
    take: ADMIN_TABLE_PAGE_SIZE,
    select,
  });

  const cards = rows.map((v) => ({
    id: v.id,
    name: v.name,
    address: v.address,
    isActive: v.isActive,
    menuItemCount: v._count.menuItems,
    eventCount: v._count.events,
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-8 lg:py-10">
      <AdminVenuesIndexHeader />

      <AdminVenuesIndexToolbar
        key={`venues-idx-toolbar-${tab}-cards`}
        tab={tab}
        viewMode="cards"
        searchQuery={q}
      />

      <AdminVenuesCardsView
        tab={tab}
        searchQuery={q}
        venues={cards}
        pagination={{
          page,
          pageSize: ADMIN_TABLE_PAGE_SIZE,
          totalItems,
        }}
      />
    </main>
  );
}
