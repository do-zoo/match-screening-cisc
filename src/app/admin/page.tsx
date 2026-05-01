import Link from "next/link";
import { redirect } from "next/navigation";
import type { VariantProps } from "class-variance-authority";
import type { EventStatus } from "@prisma/client";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { loadAdminDashboard } from "@/lib/admin/load-admin-dashboard";
import type {
  AdminDashboardEventCard,
  DashboardEventTab,
} from "@/lib/admin/dashboard-view-model";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const tabDefs: {
  tab: DashboardEventTab;
  label: string;
}[] = [
  { tab: "all", label: "Semua" },
  { tab: "active", label: "Aktif" },
  { tab: "draft", label: "Draf" },
  { tab: "finished", label: "Selesai" },
];

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

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession();
  const resolvedSearch = (await searchParams) ?? {};

  const tabParam = resolvedSearch.tab;
  const tabMissing =
    tabParam === undefined ||
    tabParam === "" ||
    (Array.isArray(tabParam) && (tabParam.length === 0 || tabParam[0] === ""));
  if (tabMissing) {
    redirect("/admin?tab=active");
  }

  const rawTab = tabParam;

  const ctx = await getAdminContext(session.user.id);

  if (!ctx) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Alert variant="destructive">
          <AlertTitle>Profil admin belum ada</AlertTitle>
          <AlertDescription>
            Akun Anda belum dikaitkan ke AdminProfile. Hubungi Owner untuk aktivasi akses PIC.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const loaded = await loadAdminDashboard(ctx, { tab: rawTab });

  if (!loaded.ok) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Alert variant="destructive">
          <AlertTitle>Gagal memuat data</AlertTitle>
          <AlertDescription>
            Terjadi kesalahan saat memuat acara dari basis data. Silakan muat ulang halaman
            beberapa saat lagi.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const { events, pendingReviewRecapTotal, tab } = loaded;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8 lg:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.email ? (
            <>
              Anda masuk sebagai <span className="font-medium text-foreground">{session.user.email}</span>
              .
            </>
          ) : (
            <>Ringkasan acara untuk PIC.</>
          )}
        </p>
      </header>

      <Alert className="border-primary/40 bg-muted/40">
        <AlertTitle>Pendaftar menunggu tinjauan</AlertTitle>
        <AlertDescription>
          {fmtNum.format(pendingReviewRecapTotal)} registrasi dengan status Menunggu tindakan pada
          acara yang Anda lihat dalam tab ini.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter status acara">
        {tabDefs.map(({ tab: key, label }) => {
          const href = `/admin?tab=${key}`;
          const active = tab === key;
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={buttonVariants({
                variant: active ? "secondary" : "outline",
                size: "sm",
                className: "rounded-full",
              })}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Tidak ada acara untuk ditampilkan dengan filter ini. Jika Anda Viewer, Anda hanya melihat acara sebagai helper — pastikan Anda ditugaskan.
        </div>
      ) : (
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((item) => (
            <EventSummaryCard key={item.id} card={item} />
          ))}
        </ul>
      )}
    </main>
  );
}

function EventSummaryCard({ card }: { card: AdminDashboardEventCard }) {
  const badge = eventStatusBadge[card.status];
  const pending = fmtNum.format(card.pendingReview);

  return (
    <li>
      <Card className="flex h-full flex-col">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-lg leading-snug">{card.title}</CardTitle>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <p>{fmtDay.format(card.startAt)}</p>
            {card.venueName ? <p className="line-clamp-1">{card.venueName}</p> : null}
          </div>
          <dl className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/50 p-2 sm:col-span-3">
              <dt className="text-xs font-medium text-muted-foreground">
                Menunggu tindakan
              </dt>
              <dd className="text-2xl font-semibold tabular-nums text-foreground">{pending}</dd>
            </div>
            <div className="rounded-md border p-2">
              <dt className="text-xs text-muted-foreground">Disetujui</dt>
              <dd className="text-sm font-semibold tabular-nums">{fmtNum.format(card.approved)}</dd>
            </div>
            <div className="rounded-md border p-2 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="text-sm font-semibold tabular-nums">{fmtNum.format(card.total)}</dd>
            </div>
          </dl>
        </CardHeader>
        <CardFooter className="mt-auto flex flex-wrap gap-3 border-t pt-4">
          <Link
            href={`/admin/events/${card.id}/inbox`}
            className={buttonVariants({ className: "inline-flex" })}
          >
            Buka inbox
          </Link>
          <Link
            href={`/admin/events/${card.id}/report`}
            className="inline-flex items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Laporan
          </Link>
        </CardFooter>
      </Card>
    </li>
  );
}
