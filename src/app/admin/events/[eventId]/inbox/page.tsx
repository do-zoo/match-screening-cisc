import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { InboxTable } from "@/components/admin/inbox-table";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { prisma } from "@/lib/db/prisma";
import { canVerifyEvent } from "@/lib/permissions/guards";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true },
  });
  return { title: event ? `Inbox · ${event.title}` : "Inbox" };
}
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

export default async function AdminEventInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;

  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pb-10 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <div className="rounded-lg border border-dashed bg-card p-6 text-sm">
          Profil admin belum ada. Hubungi Owner untuk aktivasi akses PIC.
        </div>
      </main>
    );
  }

  if (!canVerifyEvent(ctx, eventId)) notFound();

  const sp = (await searchParams) ?? {};
  const requestedPage = parseAdminTablePage(firstString(sp.page));

  const totalItems = await prisma.registration.count({
    where: { eventId },
  });
  const page = resolveClampedPage(
    requestedPage,
    totalItems,
    ADMIN_TABLE_PAGE_SIZE,
  );
  const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE;

  const [event, registrations] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    }),
    prisma.registration.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      skip,
      take: ADMIN_TABLE_PAGE_SIZE,
      include: {
        tickets: {
          select: {
            role: true,
            fullName: true,
            whatsapp: true,
            memberNumber: true,
          },
        },
      },
    }),
  ]);

  if (!event) notFound();

  const registrationRows = registrations.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  const inboxPath = `/admin/events/${eventId}/inbox`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pb-10 pt-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">{event.title}</p>
        </div>
        <Link
          href={`/admin/events/${eventId}/report`}
          className="text-sm font-medium underline-offset-4 hover:underline self-center"
        >
          Lihat laporan
        </Link>
      </header>

      <InboxTable
        eventId={eventId}
        inboxPath={inboxPath}
        registrations={registrationRows}
        pagination={{
          page,
          pageSize: ADMIN_TABLE_PAGE_SIZE,
          totalItems,
        }}
      />
    </main>
  );
}
