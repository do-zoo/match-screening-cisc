"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MoreVerticalIcon, PlusIcon, SearchIcon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ManagementRoleFormDialog } from "@/components/admin/management-role-form-dialog";
import { cn } from "@/lib/utils";
import type {
  AdminBoardRoleRowVm,
  BoardRoleAdminFilter,
} from "@/lib/management/query-admin-board-roles";

const FILTER_OPTIONS: Array<{
  value: BoardRoleAdminFilter;
  label: string;
}> = [
  { value: "all", label: "All (semua)" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
];

function buildManagementRolesHref(opts: {
  filter: BoardRoleAdminFilter;
  q: string;
}): string {
  const qs = new URLSearchParams();
  const qTrim = opts.q.trim();
  if (qTrim) qs.set("q", qTrim.slice(0, 200));
  if (opts.filter !== "all") qs.set("filter", opts.filter);
  const s = qs.toString();
  return s ? `/admin/management/roles?${s}` : "/admin/management/roles";
}

type Props = {
  roles: AdminBoardRoleRowVm[];
  directoryEmpty: boolean;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
  filter: BoardRoleAdminFilter;
  searchQuery: string;
  tabCounts: { all: number; active: number; inactive: number };
};

type EditDialogState = {
  role: AdminBoardRoleRowVm;
  mode: "edit" | "deactivate";
} | null;

export function ManagementRolesPage({
  roles,
  directoryEmpty,
  pagination,
  filter,
  searchQuery,
  tabCounts,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<EditDialogState>(null);

  const columns = useMemo<ColumnDef<AdminBoardRoleRowVm>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Nama Jabatan"
            className="text-muted-foreground"
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
      },
      {
        accessorKey: "sortOrder",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Urutan"
            className="text-muted-foreground"
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {row.original.sortOrder}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Status"
            className="text-muted-foreground"
          />
        ),
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge
              variant="outline"
              className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
            >
              Aktif
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Nonaktif
            </Badge>
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
                aria-label={`Aksi untuk ${row.original.title}`}
                render={
                  <Button type="button" variant="ghost" size="icon-sm" />
                }
              >
                <MoreVerticalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    setEditDialog({ role: row.original, mode: "edit" })
                  }
                >
                  Edit jabatan
                </DropdownMenuItem>
                {row.original.isActive ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        setEditDialog({
                          role: row.original,
                          mode: "deactivate",
                        })
                      }
                    >
                      Nonaktifkan
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [],
  );

  const counts = tabCounts;
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

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jabatan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            BoardRole — nama jabatan dan urutan tampil di roster.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Tambah
        </Button>
      </div>

      {directoryEmpty ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          Belum ada jabatan. Klik &quot;Tambah&quot; untuk menambahkan yang
          pertama.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <form
            method="get"
            action="/admin/management/roles"
            className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
          >
            <input type="hidden" name="filter" value={filter} />
            <div className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-52">
              <Label
                htmlFor="management-roles-filter"
                className="text-muted-foreground"
              >
                Filter
              </Label>
              <Select
                value={filter}
                onValueChange={(next) => {
                  if (
                    next !== "all" &&
                    next !== "active" &&
                    next !== "inactive"
                  ) {
                    return;
                  }
                  router.push(
                    buildManagementRolesHref({ filter: next, q: searchQuery }),
                  );
                }}
              >
                <SelectTrigger
                  id="management-roles-filter"
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
                placeholder="Cari nama jabatan"
                className="sm:min-w-0 sm:flex-1"
                aria-label="Cari jabatan"
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
              data={roles}
              enableSorting={false}
              emptyMessage="Tidak ada jabatan yang cocok dengan filter atau kata kunci."
              getRowClassName={(row) =>
                cn(!row.isActive && "opacity-60 hover:opacity-80")
              }
            />
            <TablePagination
              pathname="/admin/management/roles"
              preservedQuery={paginationPreserved}
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
            />
          </div>
        </div>
      )}

      <ManagementRoleFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={router.refresh}
      />
      {editDialog ? (
        <ManagementRoleFormDialog
          mode="edit"
          open
          onOpenChange={(open) => {
            if (!open) setEditDialog(null);
          }}
          role={editDialog.role}
          onSaved={router.refresh}
          defaultShowDeactivateConfirm={editDialog.mode === "deactivate"}
        />
      ) : null}
    </main>
  );
}
