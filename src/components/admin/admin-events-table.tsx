"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { EventStatus } from "@prisma/client";
import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const eventStatusBadge: Record<
  EventStatus,
  { label: string; variant: BadgeVariant }
> = {
  active: { label: "Aktif", variant: "default" },
  draft: { label: "Draf", variant: "secondary" },
  finished: { label: "Selesai", variant: "outline" },
};

export type AdminEventRow = {
  id: string;
  slug: string;
  title: string;
  status: EventStatus;
  startAtIso: string;
  picFullName: string | null;
  registrationCount: number;
};

type Props = {
  events: AdminEventRow[];
};

const fmtDay = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const fmtNum = new Intl.NumberFormat("id-ID");

export function AdminEventsTable({ events }: Props) {
  const columns = useMemo<ColumnDef<AdminEventRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Judul" />
        ),
        cell: ({ row }) => (
          <div className="max-w-[280px]">
            <Link
              href={`/admin/events/${row.original.id}/edit`}
              className="line-clamp-2 font-medium text-foreground hover:underline"
            >
              {row.original.title}
            </Link>
          </div>
        ),
      },
      {
        accessorKey: "slug",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Slug" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.slug}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const meta = eventStatusBadge[row.original.status];
          return <Badge variant={meta.variant}>{meta.label}</Badge>;
        },
      },
      {
        accessorKey: "startAtIso",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tanggal mulai" />
        ),
        cell: ({ row }) => (
          <span>{fmtDay.format(new Date(row.original.startAtIso))}</span>
        ),
        sortingFn: (a, b) =>
          a.original.startAtIso.localeCompare(b.original.startAtIso),
      },
      {
        accessorKey: "picFullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="PIC" />
        ),
        cell: ({ row }) => (
          <span className="max-w-[220px] truncate block">
            {row.original.picFullName ?? "-"}
          </span>
        ),
        sortingFn: (a, b) =>
          (a.original.picFullName ?? "").localeCompare(
            b.original.picFullName ?? "",
            "id",
          ),
      },
      {
        accessorKey: "registrationCount",
        header: ({ column }) => (
          <div className="text-right">
            <DataTableColumnHeader column={column} title="Registrasi" />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {fmtNum.format(row.original.registrationCount)}
          </div>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => (
          <div className="text-right">
            <span className="sr-only">Aksi</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            <Link
              href={`/admin/events/${row.original.id}/inbox`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Inbox
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  return <DataTable columns={columns} data={events} />;
}
