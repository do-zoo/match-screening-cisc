import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Acara" };

import { AdminEventsTable } from "@/components/admin/admin-events-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
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

  if (!hasOperationalOwnerParity(ctx.role)) {
    notFound();
  }

  const sp = (await searchParams) ?? {};
  const requestedPage = parseAdminTablePage(firstString(sp.page));

  const totalItems = await prisma.event.count();
  const page = resolveClampedPage(
    requestedPage,
    totalItems,
    ADMIN_TABLE_PAGE_SIZE,
  );
  const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE;

  const events = await prisma.event.findMany({
    orderBy: [{ startAt: "desc" }],
    skip,
    take: ADMIN_TABLE_PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      startAt: true,
      endAt: true,
      picAdminProfile: {
        select: {
          authUserId: true,
          member: { select: { fullName: true } },
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
      event.picAdminProfile.member?.fullName?.trim() ||
      u?.name?.trim() ||
      u?.email ||
      null;
    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      status: event.status,
      startAtIso: event.startAt.toISOString(),
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
        <Link href="/admin/events/new" className={buttonVariants({ variant: "default" })}>
          Buat acara
        </Link>
      </header>

      {totalItems === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada acara. Mulai dengan membuat acara baru untuk membuka pendaftaran dan inbox
          verifikasi.
        </p>
      ) : (
        <AdminEventsTable
          pathname="/admin/events"
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
