import Link from "next/link";
import { notFound } from "next/navigation";

import { RegistrationDetail } from "@/components/admin/registration-detail";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { prisma } from "@/lib/db/prisma";
import { canVerifyEvent } from "@/lib/permissions/guards";

export default async function AdminEventInboxDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; registrationId: string }>;
}) {
  const { eventId, registrationId } = await params;

  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Registration detail
        </h1>
        <div className="rounded-lg border border-dashed bg-card p-6 text-sm">
          Missing AdminProfile
        </div>
      </main>
    );
  }

  if (!canVerifyEvent(ctx, eventId)) notFound();

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, eventId },
    include: {
      event: { select: { title: true } },
      tickets: {
        orderBy: { createdAt: "asc" },
        include: {
          menuSelections: {
            include: {
              menuItem: { select: { name: true, price: true } },
            },
          },
        },
      },
      uploads: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!registration) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Registration detail
          </h1>
          <p className="text-sm text-muted-foreground">{registration.event.title}</p>
        </div>
        <Link
          href={`/admin/events/${eventId}/inbox`}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Back to inbox
        </Link>
      </header>

      <RegistrationDetail
        eventId={eventId}
        eventTitle={registration.event.title}
        registration={registration}
      />
    </main>
  );
}

