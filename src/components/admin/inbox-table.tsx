"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { RegistrationStatus, TicketRole } from "@prisma/client";

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
  tickets: Array<{
    role: TicketRole;
    fullName: string;
    whatsapp: string | null;
    memberNumber: string | null;
  }>;
};

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
          <DataTableColumnHeader column={column} title="Submitted" />
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
          <DataTableColumnHeader column={column} title="Contact" />
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
        id: "primaryTicket",
        header: "Primary ticket",
        enableSorting: false,
        cell: ({ row }) => {
          const primaryTicket = row.original.tickets.find(
            (t) => t.role === "primary",
          );
          return (
            <div>
              <div>{primaryTicket?.fullName ?? "-"}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {primaryTicket?.memberNumber ??
                  row.original.claimedMemberNumber ??
                  "non-member"}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <RegistrationStatusBadge status={row.original.status} />
        ),
      },
      {
        accessorKey: "computedTotalAtSubmit",
        header: ({ column }) => (
          <div className="text-right">
            <DataTableColumnHeader column={column} title="Total" />
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
        <CardTitle>Registrations</CardTitle>
        <CardDescription>
          Newest submissions first. Data is loaded per page from the database.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pagination.totalItems === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No registrations have been submitted for this event yet.
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
