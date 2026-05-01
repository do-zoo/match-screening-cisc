# Data Table (TanStack Table) Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a reusable client `DataTable` built on `@tanstack/react-table` and the existing shadcn/Base `Table` primitives, then migrate every admin table (`inbox-table`, members list, events index, registration detail tickets) to column definitions plus `flexRender`, following [shadcn Base data table patterns](https://ui.shadcn.com/docs/components/base/data-table) without adding new registry components (no `DropdownMenu`/column-picker — not present in repo).

**Architecture:** `DataTableColumnHeader` implements sort-toggle headers for columns that opt in (`enableSorting` defaults true unless disabled). Generic `DataTable` owns `SortingState`, `getCoreRowModel`, and `getSortedRowModel`. Call sites define `ColumnDef<T>[]` and pass serializable `data` (see RSC boundary notes). Pagination, row selection, column visibility, and global filter are **out of scope** (YAGNI); members keep their existing `Input` + activity chip filters and pass `filteredRows` as `data`.

**Tech Stack:** Next.js 16 App Router, React 19, `@tanstack/react-table` ^8.21, `@/components/ui/table` (Base “base-nova” style), `@/components/ui/button`, Vitest, pnpm, Node 24 (`nvm use` per `AGENTS.md`).

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/ui/data-table-column-header.tsx` | Client helper: sortable header with `Button` + Lucide sort icons; no-op layout when `column.getCanSort()` is false. |
| `src/components/ui/data-table.tsx` | Client generic table: `useReactTable` + `flexRender` + empty row; wraps existing `Table`/`TableRow`/etc. |
| `src/components/admin/inbox-table.tsx` | Add `"use client"`; define `InboxRegistrationRow` (serializable); `columns`; use `DataTable`. |
| `src/app/admin/events/[eventId]/inbox/page.tsx` | Serialize `createdAt` to ISO string before passing registrations to client table. |
| `src/components/admin/members-admin-page.tsx` | Replace manual `<Table>` with `columns` + `DataTable`; keep filtering UI unchanged. |
| `src/app/admin/events/page.tsx` | Map Prisma rows to plain `AdminEventRow` (dates as ISO strings); render new client `AdminEventsTable`. |
| `src/components/admin/admin-events-table.tsx` | **Create** — `"use client"`; events list columns + `DataTable`. |
| `src/components/admin/registration-tickets-table.tsx` | **Create** — `"use client"`; ticket rows built from props (menu text precomputed in RSC parent). |
| `src/components/admin/registration-detail.tsx` | Swap tickets `<Table>` block for `<RegistrationTicketsTable rows={…} />`; map ticket → row on server. |

---

### Task 1: `DataTableColumnHeader`

**Files:**

- Create: `src/components/ui/data-table-column-header.tsx`
- Modify: _(none)_
- Test: run lint after creation

- [ ] **Step 1: Add the component**

Create `src/components/ui/data-table-column-header.tsx`:

```tsx
"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableColumnHeaderProps<TData, TValue> =
  React.HTMLAttributes<HTMLDivElement> & {
    column: Column<TData, TValue>;
    title: string;
  };

export function DataTableColumnHeader<TData, TValue>({
  className,
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ms-2 h-8 gap-1"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDown className="size-4 shrink-0" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="size-4 shrink-0" />
        ) : (
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run (from repo root, Node 24):

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint
```

Expected: ESLint exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/data-table-column-header.tsx
git commit -m "feat(ui): add DataTableColumnHeader for TanStack sorting"
```

---

### Task 2: Generic `DataTable`

**Files:**

- Create: `src/components/ui/data-table.tsx`

- Modify: _(none initially)_

- Test: `pnpm lint`

- [ ] **Step 1: Add `DataTable`**

Create `src/components/ui/data-table.tsx`:

```tsx
"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No results.",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center text-muted-foreground"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Lint**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint
```

Expected: ESLint exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/data-table.tsx
git commit -m "feat(ui): add reusable DataTable with TanStack Table"
```

---

### Task 3: Migrate inbox registrations table

**Files:**

- Modify: `src/components/admin/inbox-table.tsx`

- Modify: `src/app/admin/events/[eventId]/inbox/page.tsx`

- Test: `pnpm lint`, `pnpm test`

- [ ] **Step 1: Serialize dates in the inbox page**

In `src/app/admin/events/[eventId]/inbox/page.tsx`, after `Promise.all`, map registrations so `createdAt` is an ISO string (Client Components cannot receive `Date`):

```tsx
const registrationRows = registrations.map((r) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
}));
```

Pass `registrationRows` to `<InboxTable … registrations={registrationRows} />` instead of `registrations`.

- [ ] **Step 2: Rewrite `InboxTable`**

At the top of `src/components/admin/inbox-table.tsx` add `"use client";`.

Imports to add/remove:

```tsx
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
```

Remove imports of `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table`.

Replace the `InboxRegistration` type with a serializable row type:

```tsx
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
```

Update props:

```tsx
type InboxTableProps = {
  eventId: string;
  registrations: InboxRegistrationRow[];
};
```

Inside the component, after the formatters, define columns:

```tsx
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
```

When `registrations.length === 0`, keep the existing dashed empty card (do **not** mount `DataTable` with zero rows unless you prefer a single empty message — keeping the dashed box preserves current UX).

When `registrations.length > 0`, replace `<Table>…`:

```tsx
<DataTable columns={columns} data={registrations} />
```

- [ ] **Step 3: Verify**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint && pnpm test
```

Expected: lint and tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/inbox-table.tsx src/app/admin/events/[eventId]/inbox/page.tsx
git commit -m "feat(admin): migrate inbox table to DataTable"
```

---

### Task 4: Migrate members directory table

**Files:**

- Modify: `src/components/admin/members-admin-page.tsx`

- Test: `pnpm lint`, `pnpm test`

- [ ] **Step 1: Add TanStack imports and column definitions**

Keep `"use client"` and existing filter state/UI.

Replace `Table*` imports from `@/components/ui/table` with:

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
```

After `dateFormatter` constant, add a small helper (stays in file):

```tsx
function BooleanBadge({
  value,
  trueLabel,
  falseLabel,
}: {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
}) {
  return (
    <Badge variant={value ? "secondary" : "outline"}>
      {value ? trueLabel : falseLabel}
    </Badge>
  );
}
```

Move `BooleanBadge` and `formatDate` **above** `MembersAdminPage` if they are currently below, so `columns` can reference them.

Inside `MembersAdminPage`, after `filteredRows` / before `return`, add:

```tsx
const columns = useMemo<ColumnDef<AdminMasterMemberRowVm>[]>(
  () => [
    {
      accessorKey: "memberNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nomor member" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.memberNumber}</span>
      ),
    },
    {
      accessorKey: "fullName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nama" />
      ),
    },
    {
      accessorKey: "whatsapp",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="WhatsApp" />
      ),
      cell: ({ row }) => <span>{row.original.whatsapp ?? "-"}</span>,
      sortingFn: (a, b) =>
        (a.original.whatsapp ?? "").localeCompare(
          b.original.whatsapp ?? "",
          "id",
        ),
    },
    {
      accessorKey: "isActive",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Aktif" />
      ),
      cell: ({ row }) => (
        <BooleanBadge
          value={row.original.isActive}
          trueLabel="Aktif"
          falseLabel="Nonaktif"
        />
      ),
    },
    {
      accessorKey: "isPengurus",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Pengurus" />
      ),
      cell: ({ row }) => (
        <BooleanBadge
          value={row.original.isPengurus}
          trueLabel="Ya"
          falseLabel="Tidak"
        />
      ),
    },
    {
      accessorKey: "canBePIC",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="PIC siap" />
      ),
      cell: ({ row }) => (
        <BooleanBadge
          value={row.original.canBePIC}
          trueLabel="Siap"
          falseLabel="Tidak"
        />
      ),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Terakhir diubah" />
      ),
      cell: ({ row }) => <span>{formatDate(row.original.updatedAt)}</span>,
      sortingFn: (a, b) =>
        a.original.updatedAt.localeCompare(b.original.updatedAt),
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Aksi</span>,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setEditingMember(row.original)}
          aria-label={`Edit ${row.original.fullName}`}
        >
          <PencilIcon />
        </Button>
      ),
    },
  ],
  [],
);
```

Replace the `<div className="rounded-lg border"><Table>…` block with:

```tsx
<div className="rounded-lg border">
  <DataTable
    columns={columns}
    data={filteredRows}
    emptyMessage="Tidak ada anggota yang cocok dengan filter."
  />
</div>
```

Remove the manual `filteredRows.length === 0` extra `TableRow` — `DataTable` empty row handles it.

Remove duplicate `BooleanBadge` / `formatDate` at the bottom of the file if moved up.

- [ ] **Step 2: Verify**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint && pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/members-admin-page.tsx
git commit -m "feat(admin): migrate members table to DataTable"
```

---

### Task 5: Migrate admin events index table

**Files:**

- Create: `src/components/admin/admin-events-table.tsx`

- Modify: `src/app/admin/events/page.tsx`

- Test: `pnpm lint`, `pnpm test`

- [ ] **Step 1: Create `AdminEventsTable`**

Create `src/components/admin/admin-events-table.tsx`:

```tsx
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
```

- [ ] **Step 2: Update `AdminEventsIndexPage`**

In `src/app/admin/events/page.tsx`:

- Remove direct imports of `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`.

- Remove in-file duplicates of `eventStatusBadge`, `fmtDay`, `fmtNum`, and `BadgeVariant` (they now live only in `admin-events-table`).

Add:

```tsx
import { AdminEventsTable } from "@/components/admin/admin-events-table";
```

After the `events` query, map to rows:

```tsx
const eventRows = events.map((event) => ({
  id: event.id,
  slug: event.slug,
  title: event.title,
  status: event.status,
  startAtIso: event.startAt.toISOString(),
  picFullName: event.picMasterMember?.fullName ?? null,
  registrationCount: event._count.registrations,
}));
```

In the JSX branch where `events.length > 0`, replace the `<Table>…` with:

```tsx
<AdminEventsTable events={eventRows} />
```

- [ ] **Step 3: Verify**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/admin-events-table.tsx src/app/admin/events/page.tsx
git commit -m "feat(admin): migrate events index to DataTable"
```

---

### Task 6: Migrate registration detail “Tickets” table

**Files:**

- Create: `src/components/admin/registration-tickets-table.tsx`

- Modify: `src/components/admin/registration-detail.tsx`

- Test: `pnpm lint`, `pnpm test`

- [ ] **Step 1: Create client tickets table**

Create `src/components/admin/registration-tickets-table.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { TicketRole } from "@prisma/client";

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
```

- [ ] **Step 2: Wire into `registration-detail.tsx`**

- Remove imports of `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table`.

- Add:

```tsx
import {
  RegistrationTicketsTable,
  type RegistrationTicketRow,
} from "@/components/admin/registration-tickets-table";
```

Inside `RegistrationDetail`, before `return`, build rows:

```tsx
const ticketRows: RegistrationTicketRow[] = registration.tickets.map(
  (ticket) => ({
    id: ticket.id,
    role: ticket.role,
    fullName: ticket.fullName,
    whatsapp: ticket.whatsapp,
    memberNumber: ticket.memberNumber,
    menuSummary:
      ticket.menuSelections.length === 0
        ? "-"
        : ticket.menuSelections.map((s) => s.menuItem.name).join(", "),
  }),
);
```

Remove the local `TicketRoleBadge` function from `registration-detail.tsx` (it moves to `registration-tickets-table.tsx`).

Replace the Tickets `<CardContent>` inner `<Table>…</Table>` with:

```tsx
<RegistrationTicketsTable tickets={ticketRows} />
```

Keep `<RegistrationActions … />` below the table unchanged.

- [ ] **Step 3: Verify**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/registration-tickets-table.tsx src/components/admin/registration-detail.tsx
git commit -m "feat(admin): migrate registration tickets table to DataTable"
```

---

## Spec coverage (self-review)

| Requirement | Task |
|-------------|------|
| Reusable table on TanStack + shadcn `Table` shell | Task 1–2 |
| Migrate inbox | Task 3 |
| Migrate members | Task 4 |
| Migrate events index | Task 5 |
| Migrate registration tickets | Task 6 |
| Base UI / project patterns (`Button` from `@base-ui/react`, no `asChild` Radix) | Headers use `Button` directly |
| No new shadcn registry deps | No `DropdownMenu` / `Checkbox` column added |

**Placeholder scan:** None — all steps include concrete code and commands.

**Type consistency:** `AdminEventRow.startAtIso`, `InboxRegistrationRow.createdAt`, `AdminMasterMemberRowVm.updatedAt` are ISO strings for sorting; ticket rows use precomputed `menuSummary`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-data-table-tanstack-migration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. **REQUIRED SUB-SKILL:** superpowers:subagent-driven-development.

**2. Inline Execution** — Run tasks in this session with batch checkpoints. **REQUIRED SUB-SKILL:** superpowers:executing-plans.

**Which approach?**
