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
import { ManagementRoleFormDialog } from "@/components/admin/management-role-form-dialog";
import { cn } from "@/lib/utils";

type RoleRow = {
  id: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
};

type Props = {
  roles: RoleRow[];
};

type EditDialogState = { role: RoleRow; mode: "edit" | "deactivate" } | null;

export function ManagementRolesPage({ roles }: Props) {
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

      {roles.length === 0 ? (
        <p className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
          Belum ada jabatan. Klik "Tambah" untuk menambahkan yang pertama.
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nama Jabatan</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Urutan</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {roles.map((r) => (
                <tr key={r.id} className={cn("hover:bg-muted/30", !r.isActive && "opacity-60")}>
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.sortOrder}</td>
                  <td className="px-4 py-3">
                    {r.isActive ? (
                      <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Nonaktif
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Aksi untuk ${r.title}`}
                        render={<Button type="button" variant="ghost" size="icon-sm" />}
                      >
                        <MoreVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditDialog({ role: r, mode: "edit" })}>
                          Edit jabatan
                        </DropdownMenuItem>
                        {r.isActive ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setEditDialog({ role: r, mode: "deactivate" })}
                            >
                              Nonaktifkan
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          onOpenChange={(open) => { if (!open) setEditDialog(null); }}
          role={editDialog.role}
          onSaved={router.refresh}
          defaultShowDeactivateConfirm={editDialog.mode === "deactivate"}
        />
      ) : null}
    </main>
  );
}
