"use client";

import { useMemo } from "react";
import type { TicketRole } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

export type RegistrationTicketRow = {
  id: string;
  role: TicketRole;
  fullName: string;
  whatsapp: string | null;
  memberNumber: string | null;
  menuSummary: string;
};

function TicketRoleBadge({ role }: { role: TicketRole }) {
  return (
    <Badge variant="secondary" className="capitalize">
      {role}
    </Badge>
  );
}

type Props = {
  tickets: RegistrationTicketRow[];
};

export function RegistrationTicketsTable({ tickets }: Props) {
  const columns = useMemo<ColumnDef<RegistrationTicketRow>[]>(
    () => [
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => <TicketRoleBadge role={row.original.role} />,
      },
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.fullName}</span>
        ),
      },
      {
        accessorKey: "whatsapp",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="WhatsApp" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.whatsapp ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "memberNumber",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Member #" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.memberNumber ?? "-"}
          </span>
        ),
      },
      {
        id: "menu",
        accessorKey: "menuSummary",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Menu" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.menuSummary}
          </span>
        ),
      },
    ],
    [],
  );

  return <DataTable columns={columns} data={tickets} />;
}
