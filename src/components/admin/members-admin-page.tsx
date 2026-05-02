"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DownloadIcon, PencilIcon, PlusIcon, SearchIcon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";
import { MemberCsvImportPanel } from "@/components/admin/member-csv-import-panel";
import { MemberFormDialog } from "@/components/admin/member-form-dialog";
import type { AdminMasterMemberRowVm } from "@/lib/members/query-admin-master-members";

type ActivityFilter = "all" | "active" | "inactive";

type Props = {
  rows: AdminMasterMemberRowVm[];
  csvTemplateText: string;
  filter: ActivityFilter;
  searchQuery: string;
  tabCounts: { all: number; active: number; inactive: number };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
  isOwner: boolean;
};

const activityFilters: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
];

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "short",
  timeStyle: "short",
});

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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateFormatter.format(date);
}

function buildAnggotaHref(opts: { filter: ActivityFilter; q: string }): string {
  const qs = new URLSearchParams();
  const qTrim = opts.q.trim();
  if (qTrim) qs.set("q", qTrim.slice(0, 200));
  if (opts.filter !== "all") qs.set("filter", opts.filter);
  const s = qs.toString();
  return s ? `/admin/members?${s}` : "/admin/members";
}

export function MembersAdminPage({
  rows,
  csvTemplateText,
  filter,
  searchQuery,
  tabCounts,
  pagination,
  isOwner,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMember, setEditingMember] =
    useState<AdminMasterMemberRowVm | null>(null);

  const counts = tabCounts;

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    const term = searchQuery.trim();
    if (term) params.set("q", term);
    const qs = params.toString();
    return `/admin/members/export${qs ? `?${qs}` : ""}`;
  }, [filter, searchQuery]);

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

  function refreshRows() {
    router.refresh();
  }

  const paginationPreserved =
    filter === "all" && searchQuery.trim() === ""
      ? {}
      : {
          ...(filter !== "all" ? { filter } : {}),
          ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
        };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Anggota</h1>
          <p className="text-sm text-muted-foreground">
            Kelola master anggota, status aktif, pengurus, dan kesiapan PIC.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={exportHref}
            className={buttonVariants({ variant: "outline" })}
          >
            <DownloadIcon data-icon="inline-start" />
            Ekspor CSV
          </Link>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Tambah anggota
          </Button>
        </div>
      </header>

      <MemberCsvImportPanel
        csvTemplateText={csvTemplateText}
        onImported={refreshRows}
      />

      <Card>
        <CardHeader>
          <CardTitle>Daftar anggota</CardTitle>
          <CardDescription>
            Basis data dipaginasikan dari server ({pagination.totalItems} hasil untuk
            filter ini).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            method="get"
            action="/admin/members"
            className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
          >
            <input type="hidden" name="filter" value={filter} />
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-lg">
              <Input
                name="q"
                defaultValue={searchQuery}
                placeholder="Cari nomor, nama, atau WhatsApp"
                className="sm:min-w-0 sm:flex-1"
                aria-label="Cari anggota"
              />
              <Button type="submit" variant="secondary" className="shrink-0">
                <SearchIcon data-icon="inline-start" />
                Cari
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {activityFilters.map((f) => (
                <Link
                  key={f.value}
                  href={buildAnggotaHref({
                    filter: f.value,
                    q: searchQuery,
                  })}
                  prefetch={false}
                  className={buttonVariants({
                    variant: filter === f.value ? "default" : "outline",
                  })}
                >
                  {f.label} ({counts[f.value]})
                </Link>
              ))}
            </div>
          </form>

          <div className="overflow-hidden rounded-lg border">
            <DataTable
              columns={columns}
              data={rows}
              enableSorting={false}
              emptyMessage="Tidak ada anggota yang cocok dengan filter."
            />
            <TablePagination
              pathname="/admin/members"
              preservedQuery={paginationPreserved}
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
            />
          </div>
        </CardContent>
      </Card>

      <MemberFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refreshRows}
        isOwner={isOwner}
      />
      <MemberFormDialog
        mode="edit"
        open={Boolean(editingMember)}
        onOpenChange={(open) => {
          if (!open) setEditingMember(null);
        }}
        member={editingMember}
        onSaved={refreshRows}
        isOwner={isOwner}
      />
    </main>
  );
}
