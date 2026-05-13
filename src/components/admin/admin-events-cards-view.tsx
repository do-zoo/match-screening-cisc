import Link from "next/link";

import type {
  AdminEventSummary,
  EventsIndexStatusTab,
} from "@/lib/admin/events-index-view-model";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { eventRegistrantsListPath } from "@/lib/admin/event-registrants-paths";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import type { VariantProps } from "class-variance-authority";
import type { EventStatus } from "@prisma/client";

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

export function AdminEventsCardsView({
  tab,
  searchQuery,
  events,
  showEventSettingsLink,
  pagination,
}: {
  tab: EventsIndexStatusTab;
  /** Kueri `?q=` (kosong jika tidak ada) untuk tautan paginasi. */
  searchQuery: string;
  events: AdminEventSummary[];
  showEventSettingsLink: boolean;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
}) {
  return (
    <div className="flex flex-col gap-8">
      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Tidak ada acara untuk ditampilkan dengan filter ini. Jika Anda Viewer, Anda hanya melihat
          acara sebagai helper — pastikan Anda ditugaskan.
        </div>
      ) : (
        <>
          <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((item) => (
              <EventSummaryCard
                key={item.id}
                card={item}
                showSettingsLink={showEventSettingsLink}
              />
            ))}
          </ul>
          <TablePagination
            pathname="/admin/events"
            preservedQuery={{
              tab,
              ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
            }}
            currentPage={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            className="rounded-lg border bg-card px-3 py-3"
          />
        </>
      )}
    </div>
  );
}

function EventSummaryCard({
  card,
  showSettingsLink,
}: {
  card: AdminEventSummary;
  showSettingsLink: boolean;
}) {
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
              <dt className="text-xs font-medium text-muted-foreground">Menunggu tindakan</dt>
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
            href={eventRegistrantsListPath(card.id)}
            className={buttonVariants({ className: "inline-flex" })}
          >
            Buka peserta
          </Link>
          <Link
            href={`/admin/events/${card.id}/report`}
            className="inline-flex items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Laporan
          </Link>
          {showSettingsLink ? (
            <Link
              href={`/admin/events/${card.id}/edit`}
              className="inline-flex items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Pengaturan
            </Link>
          ) : null}
        </CardFooter>
      </Card>
    </li>
  );
}
