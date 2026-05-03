"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManagementAssignmentFormDialog } from "@/components/admin/management-assignment-form-dialog";

type AssignmentRow = {
  id: string;
  boardRole: { id: string; title: string };
  managementMember: { id: string; fullName: string; publicCode: string; masterMemberId: string | null };
};

type MemberOption = { id: string; fullName: string; publicCode: string };
type RoleOption = { id: string; title: string };

type Props = {
  period: { id: string; label: string; startsAt: Date; endsAt: Date };
  assignments: AssignmentRow[];
  availableMembers: MemberOption[];
  availableRoles: RoleOption[];
  isActive: boolean;
};

type EditDialogState = { assignment: AssignmentRow; mode: "edit" | "delete" } | null;

export function ManagementPeriodDetail({
  period,
  assignments,
  availableMembers,
  availableRoles,
  isActive,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<EditDialogState>(null);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/admin/management" className="hover:text-foreground">
          ← Kepengurusan
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{period.label}</h1>
            {isActive ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Aktif
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {period.startsAt.toISOString().slice(0, 10)} → {period.endsAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Tambah Penugasan
        </Button>
      </div>

      {assignments.length === 0 ? (
        <p className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
          Belum ada penugasan. Klik "Tambah Penugasan" untuk mengisi roster periode ini.
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Jabatan</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nama Pengurus</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Kode Publik</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{a.boardRole.title}</td>
                  <td className="px-4 py-3">
                    {a.managementMember.fullName}
                    {a.managementMember.masterMemberId ? (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-400">· direktori</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {a.managementMember.publicCode}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Aksi untuk ${a.managementMember.fullName}`}
                        render={<Button type="button" variant="ghost" size="icon-sm" />}
                      >
                        <MoreVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditDialog({ assignment: a, mode: "edit" })}>
                          Ubah jabatan
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setEditDialog({ assignment: a, mode: "delete" })}
                        >
                          Hapus penugasan
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <ManagementAssignmentFormDialog
          mode="create"
          boardPeriodId={period.id}
          availableMembers={availableMembers}
          availableRoles={availableRoles}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={router.refresh}
        />
      ) : null}
      {editDialog ? (
        <ManagementAssignmentFormDialog
          mode="edit"
          boardPeriodId={period.id}
          assignment={editDialog.assignment}
          availableRoles={availableRoles}
          open
          onOpenChange={(open) => { if (!open) setEditDialog(null); }}
          onSaved={router.refresh}
          defaultShowDeleteConfirm={editDialog.mode === "delete"}
        />
      ) : null}
    </main>
  );
}
