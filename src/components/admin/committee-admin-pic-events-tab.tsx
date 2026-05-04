"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { EventStatus } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import type { VariantProps } from "class-variance-authority";

import type { EventAsPicVm } from "@/lib/admin/load-committee-admin-detail";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const EVENT_STATUS: Record<EventStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "Aktif", variant: "default" },
  draft: { label: "Draf", variant: "secondary" },
  finished: { label: "Selesai", variant: "outline" },
};

const fmtDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

export function CommitteeAdminPicEventsTab(props: { events: EventAsPicVm[] }) {
  const { events } = props;

  const activeCount = events.filter((e) => e.status === "active").length;
  const finishedCount = events.filter((e) => e.status === "finished").length;

  const columns = useMemo<ColumnDef<EventAsPicVm>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nama Acara",
      },
      {
        accessorKey: "startAtIso",
        header: "Tanggal",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {fmtDate.format(new Date(row.original.startAtIso))}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        filterFn: "equals",
        cell: ({ row }) => {
          const cfg = EVENT_STATUS[row.original.status];
          return (
            <Badge variant={cfg?.variant ?? "outline"}>
              {cfg?.label ?? row.original.status}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/admin/events/${row.original.eventId}/inbox`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            → Inbox
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      {events.length > 0 && (
        <p className="text-muted-foreground text-sm">
          {activeCount > 0 && <span>{activeCount} aktif</span>}
          {activeCount > 0 && finishedCount > 0 && <span> · </span>}
          {finishedCount > 0 && <span>{finishedCount} selesai</span>}
        </p>
      )}
      <DataTable
        columns={columns}
        data={events}
        emptyMessage="Belum ada acara sebagai PIC."
        enableGlobalFilter
        globalFilterPlaceholder="Cari nama acara..."
        filterSelectColumn="status"
        filterSelectOptions={[
          { label: "Aktif", value: "active" },
          { label: "Selesai", value: "finished" },
          { label: "Draf", value: "draft" },
        ]}
        filterSelectAllLabel="Semua status"
        enablePagination
        pageSize={10}
      />
    </div>
  );
}
