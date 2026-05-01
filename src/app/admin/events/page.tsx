import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminEventsTable } from "@/components/admin/admin-events-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";

export default async function AdminEventsIndexPage() {
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

  const events = await prisma.event.findMany({
    orderBy: [{ startAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      startAt: true,
      endAt: true,
      picMasterMember: {
        select: {
          fullName: true,
        },
      },
      _count: {
        select: {
          registrations: true,
        },
      },
    },
  });

  const eventRows = events.map((event) => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    status: event.status,
    startAtIso: event.startAt.toISOString(),
    picFullName: event.picMasterMember?.fullName ?? null,
    registrationCount: event._count.registrations,
  }));

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

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada acara. Mulai dengan membuat acara baru untuk membuka pendaftaran dan inbox
          verifikasi.
        </p>
      ) : (
        <AdminEventsTable events={eventRows} />
      )}
    </main>
  );
}
