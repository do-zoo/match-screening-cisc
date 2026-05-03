"use client";

import { LayoutListIcon, MoreVerticalIcon, NetworkIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { ManagementAssignmentFormDialog } from "@/components/admin/management-assignment-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import type { PeriodTreeRow } from "@/lib/management/query-admin-period-tree";
import type {
  AdminPeriodAssignmentRowVm,
  PeriodAssignmentAdminFilter,
} from "@/lib/management/query-admin-period-assignments";
import { cn } from "@/lib/utils";

type MemberOption = { id: string; fullName: string; publicCode: string };
type RoleOption = { id: string; title: string };

const FILTER_OPTIONS: Array<{
  value: PeriodAssignmentAdminFilter;
  label: string;
}> = [
  { value: "all", label: "All (semua)" },
  { value: "linked", label: "Terhubung" },
  { value: "unlinked", label: "Belum taut" },
];

function buildPeriodAssignmentsHref(
  periodId: string,
  opts: { filter: PeriodAssignmentAdminFilter; q: string; view: "list" | "tree" },
): string {
  const qs = new URLSearchParams();
  const qTrim = opts.q.trim();
  if (qTrim) qs.set("q", qTrim.slice(0, 200));
  if (opts.filter !== "all") qs.set("filter", opts.filter);
  if (opts.view === "tree") qs.set("view", "tree");
  const s = qs.toString();
  return s
    ? `/admin/management/${periodId}?${s}`
    : `/admin/management/${periodId}`;
}

type Props = {
  period: { id: string; label: string; startsAt: Date; endsAt: Date };
  assignments: AdminPeriodAssignmentRowVm[];
  assignmentsEmpty: boolean;
  availableMembers: MemberOption[];
  availableRoles: RoleOption[];
  isActive: boolean;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
  filter: PeriodAssignmentAdminFilter;
  searchQuery: string;
  tabCounts: { all: number; linked: number; unlinked: number };
  view: "list" | "tree";
  treeRows: PeriodTreeRow[];
};

type EditDialogState = {
  assignment: AdminPeriodAssignmentRowVm;
  mode: "edit" | "delete";
} | null;

export function ManagementPeriodDetail({
  period,
  assignments,
  assignmentsEmpty,
  availableMembers,
  availableRoles,
  isActive,
  pagination,
  filter,
  searchQuery,
  tabCounts,
  view,
  treeRows,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<EditDialogState>(null);
  const [treeAddRoleId, setTreeAddRoleId] = useState<string | undefined>(undefined);

  const columns = useMemo<ColumnDef<AdminPeriodAssignmentRowVm>[]>(
    () => [
      {
        accessorKey: "boardRole.title",
        id: "roleTitle",
        accessorFn: (row) => row.boardRole.title,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Jabatan"
            className="text-muted-foreground"
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.boardRole.title}</span>
        ),
      },
      {
        id: "memberName",
        accessorFn: (row) => row.managementMember.fullName,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Nama Pengurus"
            className="text-muted-foreground"
          />
        ),
        cell: ({ row }) => (
          <span>
            {row.original.managementMember.fullName}
            {row.original.managementMember.masterMemberId ? (
              <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                · direktori
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "publicCode",
        accessorFn: (row) => row.managementMember.publicCode,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Kode Publik"
            className="text-muted-foreground"
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {row.original.managementMember.publicCode}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Aksi untuk ${row.original.managementMember.fullName}`}
                render={
                  <Button type="button" variant="ghost" size="icon-sm" />
                }
              >
                <MoreVerticalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    setEditDialog({
                      assignment: row.original,
                      mode: "edit",
                    })
                  }
                >
                  Ubah jabatan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    setEditDialog({
                      assignment: row.original,
                      mode: "delete",
                    })
                  }
                >
                  Hapus penugasan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [],
  );

  const counts = tabCounts;
  const pathname = `/admin/management/${period.id}`;
  const paginationPreserved =
    filter === "all" && searchQuery.trim() === ""
      ? {}
      : {
          ...(filter !== "all" ? { filter } : {}),
          ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
        };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/admin/management" className="hover:text-foreground">
          ← Kepengurusan
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {period.label}
            </h1>
            {isActive ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Aktif
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {period.startsAt.toISOString().slice(0, 10)} →{" "}
            {period.endsAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/management/${period.id}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                view === "list" && "bg-muted",
              )}
            >
              <LayoutListIcon data-icon="inline-start" />
              Daftar
            </Link>
            <Link
              href={`/admin/management/${period.id}?view=tree`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                view === "tree" && "bg-muted",
              )}
            >
              <NetworkIcon data-icon="inline-start" />
              Struktur
            </Link>
          </div>
          <a
            href={`/admin/management/${period.id}/export-csv`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            download
          >
            Export CSV
          </a>
          <a
            href={`/admin/management/${period.id}/export-pdf`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            download
          >
            Export PDF
          </a>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Tambah Penugasan
          </Button>
        </div>
      </div>

      {view === "list" && (
        <>
          {assignmentsEmpty ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              Belum ada penugasan. Klik &quot;Tambah Penugasan&quot; untuk mengisi
              roster periode ini.
            </p>
          ) : (
        <div className="flex flex-col gap-4">
          <form
            method="get"
            action={pathname}
            className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
          >
            <input type="hidden" name="filter" value={filter} />
            <div className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-52">
              <Label
                htmlFor="period-assignments-filter"
                className="text-muted-foreground"
              >
                Filter
              </Label>
              <Select
                value={filter}
                onValueChange={(next) => {
                  if (
                    next !== "all" &&
                    next !== "linked" &&
                    next !== "unlinked"
                  ) {
                    return;
                  }
                  router.push(
                    buildPeriodAssignmentsHref(period.id, {
                      filter: next,
                      q: searchQuery,
                      view,
                    }),
                  );
                }}
              >
                <SelectTrigger
                  id="period-assignments-filter"
                  size="sm"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label} ({counts[f.value]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-full flex-col gap-2 sm:min-w-0 sm:max-w-lg sm:flex-1 sm:flex-row sm:items-center">
              <Input
                name="q"
                defaultValue={searchQuery}
                placeholder="Cari jabatan, nama, atau kode publik"
                className="sm:min-w-0 sm:flex-1"
                aria-label="Cari penugasan"
              />
              <Button type="submit" variant="secondary" className="shrink-0">
                <SearchIcon data-icon="inline-start" />
                Cari
              </Button>
            </div>
          </form>

          <div className="overflow-hidden rounded-lg border">
            <DataTable
              columns={columns}
              data={assignments}
              enableSorting={false}
              emptyMessage="Tidak ada penugasan yang cocok dengan filter atau kata kunci."
            />
            <TablePagination
              pathname={pathname}
              preservedQuery={paginationPreserved}
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
            />
          </div>
        </div>
          )}
        </>
      )}

      {view === "tree" && (
        <div className="rounded-lg border">
          {treeRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Belum ada jabatan. Tambahkan jabatan di halaman{" "}
              <Link href="/admin/management/roles" className="underline">
                Jabatan
              </Link>{" "}
              terlebih dahulu.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Jabatan</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Pemegang</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {treeRows.map((row) => (
                  <tr key={row.roleId} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2.5" style={{ paddingLeft: 16 + row.depth * 20 }}>
                      {row.depth > 0 && (
                        <span className="mr-1 text-muted-foreground">{"└─"}</span>
                      )}
                      <span className={cn("font-medium", row.assignees.length === 0 && "text-muted-foreground")}>
                        {row.roleTitle}
                      </span>
                      {!row.roleIsUnique && (
                        <Badge className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                          Banyak
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.assignees.length === 0 ? (
                        <span className="text-muted-foreground italic">Belum diisi</span>
                      ) : (
                        <span>
                          {row.assignees.map((a, i) => (
                            <span key={a.assignmentId}>
                              {a.fullName}
                              {a.masterMemberId && (
                                <span className="ml-1 text-xs text-green-600 dark:text-green-400">· direktori</span>
                              )}
                              {i < row.assignees.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTreeAddRoleId(row.roleId);
                          setCreateOpen(true);
                        }}
                      >
                        + Tugaskan
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ManagementAssignmentFormDialog
        mode="create"
        boardPeriodId={period.id}
        availableMembers={availableMembers}
        availableRoles={availableRoles}
        defaultRoleId={treeAddRoleId}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setTreeAddRoleId(undefined);
        }}
        onSaved={router.refresh}
      />
      {editDialog ? (
        <ManagementAssignmentFormDialog
          mode="edit"
          boardPeriodId={period.id}
          assignment={editDialog.assignment}
          availableRoles={availableRoles}
          open
          onOpenChange={(open) => {
            if (!open) setEditDialog(null);
          }}
          onSaved={router.refresh}
          defaultShowDeleteConfirm={editDialog.mode === "delete"}
        />
      ) : null}
    </main>
  );
}
