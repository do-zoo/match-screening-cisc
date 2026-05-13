import { AdminEventBreadcrumbs } from "@/components/admin/admin-event-breadcrumbs";
import { AdminEventSubnav } from "@/components/admin/admin-event-subnav";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
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
        <div className="w-full shrink-0 border-b border-border/60 bg-muted/20">
          <div className="mx-auto w-full max-w-5xl px-6 pb-3 pt-6 lg:pt-10">
            <AdminEventBreadcrumbs eventId={eventId} title={breadcrumbTitle} />
            <AdminEventSubnav eventId={eventId} />
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
