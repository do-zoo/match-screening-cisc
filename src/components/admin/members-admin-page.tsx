"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Tambah anggota
        </Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor member</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Aktif</TableHead>
                  <TableHead>Pengurus</TableHead>
                  <TableHead>PIC siap</TableHead>
                  <TableHead>Terakhir diubah</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.memberNumber}
                    </TableCell>
                    <TableCell>{row.fullName}</TableCell>
                    <TableCell>{row.whatsapp ?? "-"}</TableCell>
                    <TableCell>
                      <BooleanBadge
                        value={row.isActive}
                        trueLabel="Aktif"
                        falseLabel="Nonaktif"
                      />
                    </TableCell>
                    <TableCell>
                      <BooleanBadge
                        value={row.isPengurus}
                        trueLabel="Ya"
                        falseLabel="Tidak"
                      />
                    </TableCell>
                    <TableCell>
                      <BooleanBadge
                        value={row.canBePIC}
                        trueLabel="Siap"
                        falseLabel="Tidak"
                      />
                    </TableCell>
                    <TableCell>{formatDate(row.updatedAt)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingMember(row)}
                        aria-label={`Edit ${row.fullName}`}
                      >
                        <PencilIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Tidak ada anggota yang cocok dengan filter.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
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
