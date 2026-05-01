"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DownloadIcon, PencilIcon, PlusIcon } from "lucide-react";
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
import { MemberCsvImportPanel } from "@/components/admin/member-csv-import-panel";
import { MemberFormDialog } from "@/components/admin/member-form-dialog";
import type { AdminMasterMemberRowVm } from "@/lib/members/query-admin-master-members";

type Props = {
  initialRows: AdminMasterMemberRowVm[];
  csvTemplateText: string;
};

type ActivityFilter = "all" | "active" | "inactive";

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

export function MembersAdminPage({ initialRows, csvTemplateText }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMember, setEditingMember] =
    useState<AdminMasterMemberRowVm | null>(null);

  const counts = useMemo(
    () => ({
      all: initialRows.length,
      active: initialRows.filter((row) => row.isActive).length,
      inactive: initialRows.filter((row) => !row.isActive).length,
    }),
    [initialRows],
  );

  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase();
    return initialRows.filter((row) => {
      if (activityFilter === "active" && !row.isActive) return false;
      if (activityFilter === "inactive" && row.isActive) return false;
      if (!search) return true;

      return [row.memberNumber, row.fullName, row.whatsapp ?? ""].some((value) =>
        value.toLowerCase().includes(search),
      );
    });
  }, [activityFilter, initialRows, q]);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (activityFilter !== "all") params.set("filter", activityFilter);
    const term = q.trim();
    if (term) params.set("q", term);
    const qs = params.toString();
    return `/admin/anggota/export${qs ? `?${qs}` : ""}`;
  }, [activityFilter, q]);

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
            Menampilkan {filteredRows.length} dari {initialRows.length} anggota
            terbaru.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Cari nomor, nama, atau WhatsApp"
              className="lg:max-w-sm"
            />
            <div className="flex flex-wrap gap-2">
              {activityFilters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  variant={
                    activityFilter === filter.value ? "default" : "outline"
                  }
                  onClick={() => setActivityFilter(filter.value)}
                >
                  {filter.label} ({counts[filter.value]})
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border">
            <DataTable
              columns={columns}
              data={filteredRows}
              emptyMessage="Tidak ada anggota yang cocok dengan filter."
            />
          </div>
        </CardContent>
      </Card>

      <MemberFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refreshRows}
      />
      <MemberFormDialog
        mode="edit"
        open={Boolean(editingMember)}
        onOpenChange={(open) => {
          if (!open) setEditingMember(null);
        }}
        member={editingMember}
        onSaved={refreshRows}
      />
    </main>
  );
}
