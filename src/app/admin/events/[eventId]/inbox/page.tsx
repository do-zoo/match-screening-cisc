import { notFound } from "next/navigation";

import { InboxTable } from "@/components/admin/inbox-table";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { prisma } from "@/lib/db/prisma";
import { canVerifyEvent } from "@/lib/permissions/guards";

export default async function AdminEventInboxPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <div className="rounded-lg border border-dashed bg-card p-6 text-sm">
          Missing AdminProfile
        </div>
      </main>
    );
  }

  if (!canVerifyEvent(ctx, eventId)) notFound();

  const [event, registrations] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    }),
    prisma.registration.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
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

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">{event.title}</p>
      </header>

      <InboxTable eventId={eventId} registrations={registrations} />
    </main>
  );
}

