"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreVerticalIcon, PlusIcon, UsersRoundIcon, TagIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManagementPeriodFormDialog } from "@/components/admin/management-period-form-dialog";

type PeriodRow = {
  id: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
  assignmentCount: number;
};

type Props = {
  periods: PeriodRow[];
  activePeriodId: string | null;
};

export function ManagementHubPage({ periods, activePeriodId }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PeriodRow | null>(null);
  const [editDeleteMode, setEditDeleteMode] = useState(false);

  function refresh() {
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kepengurusan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola periode kabinet, daftar pengurus, dan jabatan organisasi.
        </p>
      </div>

      {/* Card links */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/admin/management/members"
          className="flex items-start gap-3 rounded-lg border p-4 hover:bg-muted/50"
        >
          <UsersRoundIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">Daftar Pengurus</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Kelola ManagementMember — nama, kode publik, tautan anggota.
            </p>
          </div>
        </Link>
        <Link
          href="/admin/management/roles"
          className="flex items-start gap-3 rounded-lg border p-4 hover:bg-muted/50"
        >
          <TagIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">Jabatan</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Kelola BoardRole — nama jabatan dan urutan tampil.
            </p>
          </div>
        </Link>
      </div>

      {/* Periods */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Periode Kabinet</h2>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Tambah Periode
          </Button>
        </div>

        {periods.length === 0 ? (
          <p className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            Belum ada periode. Klik "Tambah Periode" untuk membuat yang pertama.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {periods.map((p) => {
              const isActive = p.id === activePeriodId;
              return (
                <li key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.label}</span>
                    {isActive ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Aktif
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      {p.startsAt.toISOString().slice(0, 10)} →{" "}
                      {p.endsAt.toISOString().slice(0, 10)} · {p.assignmentCount} penugasan
                    </span>
                    <Link
                      href={`/admin/management/${p.id}`}
                      className="text-primary hover:underline"
                    >
                      Lihat roster →
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Aksi untuk ${p.label}`}
                        render={<Button type="button" variant="ghost" size="icon-sm" />}
                      >
                        <MoreVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingPeriod(p); setEditDeleteMode(false); }}>
                          Edit periode
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => { setEditingPeriod(p); setEditDeleteMode(true); }}
                        >
                          Hapus periode
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ManagementPeriodFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />
      {editingPeriod ? (
        <ManagementPeriodFormDialog
          mode="edit"
          open={Boolean(editingPeriod)}
          onOpenChange={(open) => { if (!open) { setEditingPeriod(null); setEditDeleteMode(false); } }}
          period={editingPeriod}
          onSaved={refresh}
          defaultShowDeleteConfirm={editDeleteMode}
        />
      ) : null}
    </main>
  );
}
