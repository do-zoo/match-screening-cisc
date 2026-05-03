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
import { ManagementMemberFormDialog } from "@/components/admin/management-member-form-dialog";

type MemberRow = {
  id: string;
  fullName: string;
  publicCode: string;
  whatsapp: string | null;
  masterMemberId: string | null;
  masterMember: { memberNumber: string } | null;
};

type MasterMemberOption = { id: string; memberNumber: string; fullName: string };

type Props = {
  members: MemberRow[];
  availableMasterMembers: MasterMemberOption[];
};

export function ManagementMembersPage({ members, availableMasterMembers }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/admin/management" className="hover:text-foreground">
          ← Kepengurusan
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daftar Pengurus</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ManagementMember — kode publik digunakan di form pendaftaran acara.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Tambah
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
          Belum ada pengurus. Klik "Tambah" untuk menambahkan yang pertama.
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nama</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Kode Publik</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">No. Member</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{m.fullName}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{m.publicCode}</td>
                  <td className="px-4 py-3">
                    {m.masterMember ? (
                      <Badge
                        variant="outline"
                        className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                      >
                        {m.masterMember.memberNumber}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Aksi untuk ${m.fullName}`}
                        render={<Button type="button" variant="ghost" size="icon-sm" />}
                      >
                        <MoreVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingMember(m)}>
                          Edit pengurus
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setEditingMember(m)}
                        >
                          Hapus pengurus
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

      <ManagementMemberFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        availableMasterMembers={availableMasterMembers}
        onSaved={router.refresh}
      />
      {editingMember ? (
        <ManagementMemberFormDialog
          mode="edit"
          open
          onOpenChange={(open) => { if (!open) setEditingMember(null); }}
          member={editingMember}
          availableMasterMembers={availableMasterMembers}
          onSaved={router.refresh}
        />
      ) : null}
    </main>
  );
}
