"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  AttendanceStatus,
  RegistrationStatus,
  TicketRole,
} from "@prisma/client";

import { RegistrationStatusBadge } from "@/components/admin/registration-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { TablePagination } from "@/components/ui/table-pagination";

type InboxRegistrationRow = {
  id: string;
  createdAt: string;
  contactName: string;
  contactWhatsapp: string;
  claimedMemberNumber: string | null;
  computedTotalAtSubmit: number;
  status: RegistrationStatus;
  ticketRole: TicketRole;
  attendanceStatus: AttendanceStatus;
  primaryRegistration: { id: string; contactName: string } | null;
};

function attendanceLabel(s: AttendanceStatus): string {
  if (s === "attended") return "Hadir";
  if (s === "no_show") return "Tidak hadir";
  return "Belum dicatat";
}

function ticketRoleLabel(role: TicketRole): string {
  return role === "primary" ? "Utama" : "Partner";
}

type InboxTableProps = {
  eventId: string;
  /** Path without query, e.g. `/admin/events/{id}/inbox`. */
  inboxPath: string;
  registrations: InboxRegistrationRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function InboxTable({
  eventId,
  inboxPath,
  registrations,
  pagination,
}: InboxTableProps) {
  const columns = useMemo<ColumnDef<InboxRegistrationRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Dikirim" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {dateFormatter.format(new Date(row.original.createdAt))}
          </span>
        ),
      },
      {
        id: "contact",
        accessorFn: (row) => row.contactName,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Kontak" />
        ),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div>
              <Link
                href={`/admin/events/${eventId}/inbox/${r.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {r.contactName}
              </Link>
              <div className="font-mono text-xs text-muted-foreground">
                {r.contactWhatsapp}
              </div>
            </div>
          );
        },
      },
      {
        id: "ticketSummary",
        header: "Tiket / pemilik",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          if (r.ticketRole === "partner" && r.primaryRegistration) {
            return (
              <div className="text-sm">
                <div className="font-medium">{r.contactName}</div>
                <div className="text-muted-foreground">
                  Partner dari{" "}
                  <Link
                    href={`/admin/events/${eventId}/inbox/${r.primaryRegistration.id}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {r.primaryRegistration.contactName}
                  </Link>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {r.claimedMemberNumber ?? "—"}
                </div>
              </div>
            );
          }
          return (
            <div>
              <div className="font-medium">{r.contactName}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {r.claimedMemberNumber ?? "non-member"}
              </div>
            </div>
          );
        },
      },
      {
        id: "ticketRole",
        header: "Peran",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm">{ticketRoleLabel(row.original.ticketRole)}</span>
        ),
      },
      {
        id: "attendance",
        header: "Kehadiran",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {attendanceLabel(row.original.attendanceStatus)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status pendaftaran" />
        ),
        cell: ({ row }) => (
          <RegistrationStatusBadge status={row.original.status} />
        ),
      },
      {
        accessorKey: "computedTotalAtSubmit",
        header: ({ column }) => (
          <div className="text-right">
            <DataTableColumnHeader column={column} title="Total bayar" />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {idrFormatter.format(row.original.computedTotalAtSubmit)}
          </div>
        ),
      },
    ],
    [eventId],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendaftaran</CardTitle>
        <CardDescription>
          Urutan terbaru dulu. Data dimuat per halaman dari basis data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pagination.totalItems === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Belum ada pendaftaran untuk acara ini.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <DataTable
              columns={columns}
              data={registrations}
              enableSorting={false}
            />
            <TablePagination
              pathname={inboxPath}
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
