import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canVerifyEvent } from "@/lib/permissions/guards";
import { getEventReport } from "@/lib/reports/queries";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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
  return { title: event ? `Laporan · ${event.title}` : "Laporan" };
}

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default async function EventReportPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx) notFound();
  if (!canVerifyEvent(ctx, eventId)) notFound();

  const [event, report] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, status: true },
    }),
    getEventReport(eventId),
  ]);

  if (!event) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pb-10 pt-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Laporan acara
          </h1>
          <p className="text-sm text-muted-foreground">{event.title}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/admin/events/${eventId}/report/export`}
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent/60 transition-colors"
          >
            Unduh CSV
          </Link>
        </div>
      </header>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle>Peserta</CardTitle>
          <CardDescription>
            Total: {report.participant.total} pendaftaran
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Member" value={report.participant.memberCount} />
          <Stat label="Non-member" value={report.participant.nonMemberCount} />
          <Stat label="Partner" value={report.participant.partnerCount} />
          {Object.entries(report.participant.byStatus).map(
            ([status, count]) => (
              <Stat
                key={status}
                label={status.replace(/_/g, " ")}
                value={count}
              />
            ),
          )}
        </CardContent>
      </Card>

      {/* Finance */}
      <Card>
        <CardHeader>
          <CardTitle>Keuangan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="Total baseline (approved)"
            value={idr(report.finance.baselineTotal)}
          />
          <Stat
            label="Pendapatan tiket (approved)"
            value={idr(report.finance.ticketRevenueApproved)}
          />
          <Stat
            label="Pendapatan menu wajib (approved)"
            value={idr(report.finance.menuRevenueApproved)}
          />
          <Stat
            label="Penyesuaian lunas"
            value={idr(report.finance.adjustmentsPaidTotal)}
          />
          <Stat
            label="Penyesuaian belum lunas"
            value={idr(report.finance.adjustmentsUnpaidTotal)}
          />
          <Stat
            label="Refund"
            value={`${report.finance.refundCount} pendaftaran`}
          />
        </CardContent>
      </Card>

      {/* Menu wajib */}
      <Card>
        <CardHeader>
          <CardTitle>Menu wajib</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {report.menu.byItem.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Belum ada data menu per pendaftaran.
              </p>
            )}
            {report.menu.byItem.map((item) => (
              <Badge key={item.name} variant="secondary">
                {item.name}: {item.count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Kehadiran</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Stat label="Hadir" value={report.attendance.attended} />
          <Stat label="Tidak hadir" value={report.attendance.noShow} />
          <Stat label="Belum dicatat" value={report.attendance.unknown} />
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="text-xs text-muted-foreground capitalize">{label}</div>
      <div className="text-xl font-semibold font-mono tabular-nums">
        {value}
      </div>
    </div>
  );
}
