import { AdminVenueBreadcrumbs } from "@/components/admin/admin-venue-breadcrumbs";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";

export default async function AdminVenueBranchLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ venueId: string }>;
}>) {
  const { venueId } = await params;

  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  let breadcrumbName: string | null = null;
  if (ctx && hasOperationalOwnerParity(ctx.role)) {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { name: true },
    });
    breadcrumbName = venue?.name ?? null;
  }

  return (
    <div data-admin-venue-chrome className="flex min-h-0 flex-1 flex-col">
      {breadcrumbName ? (
        <div className="border-border/60 bg-muted/20 w-full shrink-0 border-b">
          <div className="mx-auto w-full max-w-6xl px-6 pb-3 pt-6 lg:pt-10">
            <AdminVenueBreadcrumbs venueId={venueId} name={breadcrumbName} />
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
