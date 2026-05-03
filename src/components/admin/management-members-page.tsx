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
import { ManagementMemberFormDialog } from "@/components/admin/management-member-form-dialog";
import type {
  AdminManagementMemberRowVm,
  ManagementMemberAdminFilter,
} from "@/lib/management/query-admin-management-members";

type MasterMemberOption = {
  id: string;
  memberNumber: string;
  fullName: string;
};

const FILTER_OPTIONS: Array<{
  value: ManagementMemberAdminFilter;
  label: string;
}> = [
  { value: "all", label: "All (semua)" },
  { value: "linked", label: "Terhubung" },
  { value: "unlinked", label: "Belum taut" },
];

function buildManagementMembersHref(opts: {
  filter: ManagementMemberAdminFilter;
  q: string;
}): string {
  const qs = new URLSearchParams();
  const qTrim = opts.q.trim();
  if (qTrim) qs.set("q", qTrim.slice(0, 200));
  if (opts.filter !== "all") qs.set("filter", opts.filter);
  const s = qs.toString();
  return s ? `/admin/management/members?${s}` : "/admin/management/members";
}

type Props = {
  members: AdminManagementMemberRowVm[];
  availableMasterMembers: MasterMemberOption[];
  directoryEmpty: boolean;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
  filter: ManagementMemberAdminFilter;
  searchQuery: string;
  tabCounts: { all: number; linked: number; unlinked: number };
};

type EditDialogState = {
  member: AdminManagementMemberRowVm;
  mode: "edit" | "delete";
} | null;

export function ManagementMembersPage({
  members,
  availableMasterMembers,
  directoryEmpty,
  pagination,
  filter,
  searchQuery,
  tabCounts,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<EditDialogState>(null);

  const columns = useMemo<ColumnDef<AdminManagementMemberRowVm>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Nama"
            className="text-muted-foreground"
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.fullName}</span>
        ),
      },
      {
        accessorKey: "publicCode",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Kode Publik"
            className="text-muted-foreground"
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {row.original.publicCode}
          </span>
        ),
      },
      {
        id: "memberNumber",
        accessorFn: (row) => row.masterMember?.memberNumber ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="No. Member"
            className="text-muted-foreground"
          />
        ),
        cell: ({ row }) =>
          row.original.masterMember ? (
            <Badge
              variant="outline"
              className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
            >
              {row.original.masterMember.memberNumber}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
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
                aria-label={`Aksi untuk ${row.original.fullName}`}
                render={<Button type="button" variant="ghost" size="icon-sm" />}
              >
                <MoreVerticalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    setEditDialog({ member: row.original, mode: "edit" })
                  }
                >
                  Edit pengurus
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    setEditDialog({ member: row.original, mode: "delete" })
                  }
                >
                  Hapus pengurus
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Daftar Pengurus
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ManagementMember — kode publik digunakan di form pendaftaran acara.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Tambah
        </Button>
      </div>

      {directoryEmpty ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          Belum ada pengurus. Klik &quot;Tambah&quot; untuk menambahkan yang
          pertama.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <form
            method="get"
            action="/admin/management/members"
            className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
          >
            <input type="hidden" name="filter" value={filter} />
            <div className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-52">
              <Label
                htmlFor="management-members-filter"
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
                    buildManagementMembersHref({
                      filter: next,
                      q: searchQuery,
                    }),
                  );
                }}
              >
                <SelectTrigger
                  id="management-members-filter"
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
                placeholder="Cari nama, kode publik, atau WhatsApp"
                className="sm:min-w-0 sm:flex-1"
                aria-label="Cari pengurus"
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
              data={members}
              enableSorting={false}
              emptyMessage="Tidak ada pengurus yang cocok dengan filter atau kata kunci."
            />
            <TablePagination
              pathname="/admin/management/members"
              preservedQuery={paginationPreserved}
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
            />
          </div>
        </div>
      )}

      <ManagementMemberFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        availableMasterMembers={availableMasterMembers}
        onSaved={router.refresh}
      />
      {editDialog ? (
        <ManagementMemberFormDialog
          mode="edit"
          open
          onOpenChange={(open) => {
            if (!open) setEditDialog(null);
          }}
          member={editDialog.member}
          availableMasterMembers={availableMasterMembers}
          onSaved={router.refresh}
          defaultShowDeleteConfirm={editDialog.mode === "delete"}
        />
      ) : null}
    </main>
  );
}
