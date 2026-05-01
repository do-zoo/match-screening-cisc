"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import type {
  CommitteeAdminDirectoryRowVm,
  CommitteeAdminDirectoryVm,
} from "@/lib/admin/load-committee-admin-directory";
import {
  addCommitteeAdminByEmail,
  revokeCommitteeAdminMeaningfulAccess,
  updateCommitteeAdminMemberLink,
  updateCommitteeAdminRole,
} from "@/lib/actions/admin-committee-profiles";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActionResult } from "@/lib/forms/action-result";

const ROLE_LABELS: Record<string, string> = {
  Owner: "Owner",
  Admin: "Admin",
  Verifier: "Verifier",
  Viewer: "Viewer",
};

function formatSessionHint(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fieldErrorsLines(fieldErrors?: Record<string, string>) {
  if (!fieldErrors || Object.keys(fieldErrors).length === 0) return null;
  return Object.entries(fieldErrors)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

type ManageFormsProps = {
  row: CommitteeAdminDirectoryRowVm;
  memberOptions: CommitteeAdminDirectoryVm["memberOptions"];
  onAnySuccess: () => void;
  manageKey: number;
};

function ManageAdminDialogs(props: ManageFormsProps) {
  const { row, onAnySuccess } = props;

  const [roleState, roleDispatch, rolePending] = useActionState(
    updateCommitteeAdminRole,
    null as ActionResult<{ saved: true }> | null,
  );
  const [memberState, memberDispatch, memberPending] = useActionState(
    updateCommitteeAdminMemberLink,
    null as ActionResult<{ saved: true }> | null,
  );
  const [revokeState, revokeDispatch, revokePending] = useActionState(
    revokeCommitteeAdminMeaningfulAccess,
    null as ActionResult<{ saved: true }> | null,
  );

  useEffect(() => {
    if (roleState?.ok || memberState?.ok || revokeState?.ok) {
      onAnySuccess();
    }
  }, [roleState?.ok, memberState?.ok, revokeState?.ok, onAnySuccess]);

  const flagLinesRole = fieldErrorsLines(
    roleState?.ok === false ? roleState.fieldErrors : undefined,
  );
  const flagLinesMember = fieldErrorsLines(
    memberState?.ok === false ? memberState.fieldErrors : undefined,
  );
  const flagLinesRevoke = fieldErrorsLines(
    revokeState?.ok === false ? revokeState.fieldErrors : undefined,
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog>
        <DialogTrigger disabled={rolePending} render={<Button variant="outline" size="sm" />}>
          Ubah peran
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah peran admin</DialogTitle>
            <DialogDescription>
              {row.email} — peran baru berlaku segera setelah disimpan.
            </DialogDescription>
          </DialogHeader>
          <form
            action={roleDispatch}
            className="space-y-4"
            key={`r-${props.manageKey}-${row.adminProfileId}`}
          >
            <input type="hidden" name="adminProfileId" value={row.adminProfileId} />
            {roleState?.ok === false && roleState.rootError ? (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{roleState.rootError}</AlertDescription>
              </Alert>
            ) : null}
            {flagLinesRole ? (
              <Alert variant="destructive">
                <AlertTitle>Periksa isian</AlertTitle>
                <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                  {flagLinesRole}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`role-${row.adminProfileId}`}>Peran</Label>
              <select
                id={`role-${row.adminProfileId}`}
                name="role"
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                defaultValue={row.role}
                disabled={rolePending}
                required
              >
                <option value="Owner">Owner</option>
                <option value="Admin">Admin</option>
                <option value="Verifier">Verifier</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={rolePending}>
                {rolePending ? <Loader2 className="size-4 animate-spin" /> : "Simpan peran"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger disabled={memberPending} render={<Button variant="outline" size="sm" />}>
          Tautan anggota
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hubungkan ke MasterMember</DialogTitle>
            <DialogDescription>
              Opsional. PIC, rekening, dan flag PIC dikelola di halaman Anggota.
            </DialogDescription>
          </DialogHeader>
          <form
            action={memberDispatch}
            className="space-y-4"
            key={`m-${props.manageKey}-${row.adminProfileId}`}
          >
            <input type="hidden" name="adminProfileId" value={row.adminProfileId} />
            {memberState?.ok === false && memberState.rootError ? (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{memberState.rootError}</AlertDescription>
              </Alert>
            ) : null}
            {flagLinesMember ? (
              <Alert variant="destructive">
                <AlertTitle>Periksa isian</AlertTitle>
                <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                  {flagLinesMember}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`member-${row.adminProfileId}`}>Anggota</Label>
              <select
                id={`member-${row.adminProfileId}`}
                name="memberId"
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                defaultValue={row.memberId ?? ""}
                disabled={memberPending}
              >
                <option value="">— Tidak dikaitkan</option>
                {props.memberOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={memberPending}>
                {memberPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Simpan tautan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger disabled={revokePending} render={<Button variant="destructive" size="sm" />}>
          Cabut akses
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cabut akses bermakna</DialogTitle>
            <DialogDescription>
              Mengatur peran menjadi Viewer dan menghapus tautan anggota untuk{" "}
              <strong>{row.email}</strong>. Profil tidak dihapus.
            </DialogDescription>
          </DialogHeader>
          {revokeState?.ok === false && revokeState.rootError ? (
            <Alert variant="destructive">
              <AlertTitle>Gagal</AlertTitle>
              <AlertDescription>{revokeState.rootError}</AlertDescription>
            </Alert>
          ) : null}
          {flagLinesRevoke ? (
            <Alert variant="destructive">
              <AlertTitle>Periksa isian</AlertTitle>
              <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                {flagLinesRevoke}
              </AlertDescription>
            </Alert>
          ) : null}
          <form
            action={revokeDispatch}
            key={`v-${props.manageKey}-${row.adminProfileId}`}
          >
            <input type="hidden" name="adminProfileId" value={row.adminProfileId} />
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={revokePending}>
                {revokePending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Ya, cabut akses"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CommitteeAdminSettingsPanel(props: {
  directory: CommitteeAdminDirectoryVm;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [manageKey, setManageKey] = useState(0);

  const onManageSuccess = useCallback(() => {
    setManageKey((k) => k + 1);
  }, []);

  const [addState, addDispatch, addPending] = useActionState(
    addCommitteeAdminByEmail,
    null as ActionResult<{ created: true }> | null,
  );

  useEffect(() => {
    if (!addState?.ok) return;
    // useActionState has no imperative reset; close + key bump so reopen shows a fresh shell.
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- post-mutation UI sync only */
    setAddOpen(false);
    setAddKey((k) => k + 1);
  }, [addState?.ok]);

  const addFieldLines = fieldErrorsLines(
    addState?.ok === false ? addState.fieldErrors : undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Admin terdaftar</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger disabled={addPending} render={<Button />}>
            Tambah admin…
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah admin dari email</DialogTitle>
              <DialogDescription>
                Pengguna harus sudah punya akun (pernah masuk atau mendaftar). Peran default:
                Viewer — ubah melalui &ldquo;Ubah peran&rdquo;.
              </DialogDescription>
            </DialogHeader>
            <form action={addDispatch} className="space-y-4" key={`add-${addKey}`}>
              {addState?.ok === false && addState.rootError ? (
                <Alert variant="destructive">
                  <AlertTitle>Gagal</AlertTitle>
                  <AlertDescription>{addState.rootError}</AlertDescription>
                </Alert>
              ) : null}
              {addFieldLines ? (
                <Alert variant="destructive">
                  <AlertTitle>Periksa isian</AlertTitle>
                  <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                    {addFieldLines}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="committee-admin-email">Email</Label>
                <Input
                  id="committee-admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={addPending}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={addPending}>
                  {addPending ? <Loader2 className="size-4 animate-spin" /> : "Tambahkan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Anggota terkait</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>Aktivitas sesi*</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.directory.rows.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={7}>
                  Belum ada AdminProfile.
                </TableCell>
              </TableRow>
            ) : (
              props.directory.rows.map((row) => (
                <TableRow key={row.adminProfileId}>
                  <TableCell className="font-mono text-xs sm:text-sm">
                    {row.email}
                  </TableCell>
                  <TableCell>{row.displayName}</TableCell>
                  <TableCell>{ROLE_LABELS[row.role] ?? row.role}</TableCell>
                  <TableCell>{row.memberSummary ?? "—"}</TableCell>
                  <TableCell>{row.twoFactorEnabled ? "Ya" : "Tidak"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatSessionHint(row.lastSessionActivityAtIso)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ManageAdminDialogs
                      row={row}
                      memberOptions={props.directory.memberOptions}
                      manageKey={manageKey}
                      onAnySuccess={onManageSuccess}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        <span className="font-medium text-foreground">*</span> Berdasarkan sesi aktif yang belum
        kedaluwarsa (pembaruan terbaru dari tabel sesi Better Auth).         Untuk rekonsiliasi lebih lengkap pakai Pengaturan →{" "}
        <Link href="/admin/settings/security" className="underline underline-offset-4">
          Keamanan
        </Link>{" "}
        (log audit). Darurat penyediaan akun baru masih bisa lewat CLI{" "}
        <code className="font-mono text-[11px]">pnpm bootstrap:admin</code>.
      </p>
    </div>
  );
}
