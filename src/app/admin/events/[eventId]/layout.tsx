import { AdminEventBreadcrumbs } from "@/components/admin/admin-event-breadcrumbs";
import { AdminEventSubnav } from "@/components/admin/admin-event-subnav";
import { getAdminContext } from "@/lib/auth/admin-context";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/session";
import { canVerifyEvent } from "@/lib/permissions/guards";

export default async function AdminEventBranchLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}>) {
  const { eventId } = await params;

  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  let breadcrumbTitle: string | null = null;
  if (ctx && canVerifyEvent(ctx, eventId)) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    });
    breadcrumbTitle = event?.title ?? null;
  }

  return (
    <div data-admin-event-chrome className="flex min-h-0 flex-1 flex-col">
      {breadcrumbTitle ? (
        <div className="mx-auto w-full max-w-6xl shrink-0 border-b border-border/60 bg-muted/20 px-6 pb-3 pt-6 lg:pt-10">
          <AdminEventBreadcrumbs eventId={eventId} title={breadcrumbTitle} />
          <AdminEventSubnav eventId={eventId} />
        </div>
      ) : null}
      {children}
    </div>
  );
}
