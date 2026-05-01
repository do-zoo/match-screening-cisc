import Link from "next/link";
import { notFound } from "next/navigation";
import type { EventStatus } from "@prisma/client";
import type { VariantProps } from "class-variance-authority";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasOperationalOwnerParity } from "@/lib/permissions/roles";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const eventStatusBadge: Record<EventStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "Aktif", variant: "default" },
  draft: { label: "Draf", variant: "secondary" },
  finished: { label: "Selesai", variant: "outline" },
};

const fmtDay = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const fmtNum = new Intl.NumberFormat("id-ID");

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Judul</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tanggal mulai</TableHead>
              <TableHead>PIC</TableHead>
              <TableHead className="text-right">Registrasi</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const statusBadge = eventStatusBadge[event.status];

              return (
                <TableRow key={event.id}>
                  <TableCell className="max-w-[280px]">
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="line-clamp-2 font-medium text-foreground hover:underline"
                    >
                      {event.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{event.slug}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                  </TableCell>
                  <TableCell>{fmtDay.format(event.startAt)}</TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {event.picMasterMember?.fullName ?? "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNum.format(event._count.registrations)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/events/${event.id}/inbox`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Inbox
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
