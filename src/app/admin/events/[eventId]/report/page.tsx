import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canVerifyEvent } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { getEventReport } from "@/lib/reports/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
          <h1 className="text-2xl font-semibold tracking-tight">Laporan acara</h1>
          <p className="text-sm text-muted-foreground">{event.title}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/admin/events/${eventId}/report/export`}
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent/60 transition-colors"
          >
            Unduh CSV
          </Link>
          <Link
            href={`/admin/events/${eventId}/inbox`}
            className="text-sm font-medium underline-offset-4 hover:underline self-center"
          >
            Kembali ke inbox
          </Link>
        </div>
      </header>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle>Peserta</CardTitle>
          <CardDescription>Total: {report.participant.total} pendaftaran</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Member" value={report.participant.memberCount} />
          <Stat label="Non-member" value={report.participant.nonMemberCount} />
          <Stat label="Partner" value={report.participant.partnerCount} />
          {Object.entries(report.participant.byStatus).map(([status, count]) => (
            <Stat key={status} label={status.replace(/_/g, " ")} value={count} />
          ))}
        </CardContent>
      </Card>

      {/* Finance */}
      <Card>
        <CardHeader>
          <CardTitle>Keuangan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total baseline (approved)" value={idr(report.finance.baselineTotal)} />
          <Stat label="Penyesuaian lunas" value={idr(report.finance.adjustmentsPaidTotal)} />
          <Stat label="Penyesuaian belum lunas" value={idr(report.finance.adjustmentsUnpaidTotal)} />
          <Stat label="Refund" value={`${report.finance.refundCount} pendaftaran`} />
        </CardContent>
      </Card>

      {/* Menu/Voucher */}
      <Card>
        <CardHeader>
          <CardTitle>Menu / Voucher</CardTitle>
        </CardHeader>
        <CardContent>
          {report.menu.mode === "PRESELECT" ? (
            <div className="flex flex-wrap gap-2">
              {report.menu.byItem.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada pemilihan menu.</p>
              )}
              {report.menu.byItem.map((item) => (
                <Badge key={item.name} variant="secondary">
                  {item.name}: {item.count}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Stat label="Voucher sudah ditukar" value={report.menu.redeemed} />
              <Stat label="Voucher belum ditukar" value={report.menu.notRedeemed} />
            </div>
          )}
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
      <div className="text-xl font-semibold font-mono tabular-nums">{value}</div>
    </div>
  );
}
