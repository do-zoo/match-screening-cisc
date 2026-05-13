import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Acara" };

import { AdminEventsDashboardCards } from "@/components/admin/admin-events-dashboard-cards";
import { AdminEventsTable } from "@/components/admin/admin-events-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { parseEventsIndexViewParam } from "@/lib/admin/events-index-view";
import { loadAdminDashboard } from "@/lib/admin/load-admin-dashboard";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";
import {
  ADMIN_TABLE_PAGE_SIZE,
  parseAdminTablePage,
  resolveClampedPage,
} from "@/lib/table/admin-pagination";

function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined;
  if (Array.isArray(param)) return param[0];
  return param;
}

function tabParamMissing(
  tabParam: string | string[] | undefined,
): boolean {
  return (
    tabParam === undefined ||
    tabParam === "" ||
    (Array.isArray(tabParam) && (tabParam.length === 0 || tabParam[0] === ""))
  );
}

export default async function AdminEventsIndexPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Acara</h1>
        <Alert variant="destructive">
          <AlertTitle>Profil admin belum ada</AlertTitle>
          <AlertDescription>
            Akun Anda belum dikaitkan ke AdminProfile. Hubungi Owner untuk aktivasi akses PIC.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const sp = (await searchParams) ?? {};
  const isOps = hasOperationalOwnerParity(ctx.role);
  const viewMode = isOps ? parseEventsIndexViewParam(sp.view) : "cards";

  if (viewMode === "cards" && tabParamMissing(sp.tab)) {
    redirect("/admin/events?tab=active");
  }

  if (viewMode === "table" && isOps) {
    const requestedPage = parseAdminTablePage(firstString(sp.page));

    const totalItems = await prisma.event.count();
    const page = resolveClampedPage(
      requestedPage,
      totalItems,
      ADMIN_TABLE_PAGE_SIZE,
    );
    const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE;

    const events = await prisma.event.findMany({
      orderBy: [{ kickOffAt: "desc" }],
      skip,
      take: ADMIN_TABLE_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        kickOffAt: true,
        picAdminProfile: {
          select: {
            authUserId: true,
            managementMember: { select: { fullName: true } },
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    });

    const picAuthIds = [
      ...new Set(events.map((e) => e.picAdminProfile.authUserId)),
    ];
    const picUsers =
      picAuthIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: picAuthIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userById = new Map(picUsers.map((u) => [u.id, u]));

    const eventRows = events.map((event) => {
      const u = userById.get(event.picAdminProfile.authUserId);
      const picFullName =
        event.picAdminProfile.managementMember?.fullName?.trim() ||
        u?.name?.trim() ||
        u?.email ||
        null;
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        status: event.status,
        startAtIso: event.kickOffAt.toISOString(),
        picFullName,
        registrationCount: event._count.registrations,
      };
    });

    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 lg:py-10">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Acara</h1>
            <p className="text-sm text-muted-foreground">
              Kelola daftar acara, PIC, dan akses cepat ke inbox registrasi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/events?tab=active"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Tampilan kartu
            </Link>
            <Link href="/admin/events/new" className={buttonVariants({ variant: "default" })}>
              Buat acara
            </Link>
          </div>
        </header>

        {totalItems === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada acara. Mulai dengan membuat acara baru untuk membuka pendaftaran dan inbox
            verifikasi.
          </p>
        ) : (
          <AdminEventsTable
            pathname="/admin/events"
            preservedQuery={{ view: "tabel" }}
            events={eventRows}
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

  const loaded = await loadAdminDashboard(ctx, { tab: sp.tab });

  if (!loaded.ok) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Acara</h1>
        <Alert variant="destructive">
          <AlertTitle>Gagal memuat data</AlertTitle>
          <AlertDescription>
            Terjadi kesalahan saat memuat acara dari basis data. Silakan muat ulang halaman beberapa
            saat lagi.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const { events, pendingReviewRecapTotal, tab } = loaded;

  return (
    <AdminEventsDashboardCards
      session={session}
      tab={tab}
      events={events}
      pendingReviewRecapTotal={pendingReviewRecapTotal}
      showTableViewLink={isOps}
      showCreateEventButton={isOps}
    />
  );
}
