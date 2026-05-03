"use client";

import {
  Fragment,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, MoreVerticalIcon } from "lucide-react";
import { AdminRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type {
  CommitteeAdminDirectoryRowVm,
  CommitteeAdminDirectoryVm,
} from "@/lib/admin/load-committee-admin-directory";
import { viewerMayUseOwnerOnlyCommitteeControls } from "@/lib/admin/pic-bank-account-permissions";
import type { PendingAdminInvitationRowVm } from "@/lib/admin/load-pending-admin-invitations";
import { AdminPicBankAccountsInline } from "@/components/admin/admin-pic-bank-accounts-inline";
import {
  createAdminInvitation,
  revokeAdminInvitation,
  type CreateAdminInvitationResult,
} from "@/lib/actions/admin-admin-invitations";
import {
  deleteCommitteeAdmin,
  revokeCommitteeAdminMeaningfulAccess,
  updateCommitteeAdminMemberLink,
  updateCommitteeAdminRole,
} from "@/lib/actions/admin-committee-profiles";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActionResult } from "@/lib/forms/action-result";
import { toastCudSuccess } from "@/lib/client/cud-notify";

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

function formatInviteExpiry(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Peran undangan — daftar pendek → Select (bukan Combobox). */
function InviteInviteeRoleSelect({ disabled }: { disabled: boolean }) {
  const [role, setRole] = useState<AdminRole>(AdminRole.Viewer);

  return (
    <>
      <input type="hidden" name="role" value={role} />
      <Select
        value={role}
        onValueChange={(v) => {
          if (v != null) setRole(v as AdminRole);
        }}
        disabled={disabled}
      >
        <SelectTrigger id="invite-admin-role" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AdminRole.Admin}>Admin</SelectItem>
          <SelectItem value={AdminRole.Verifier}>Verifier</SelectItem>
          <SelectItem value={AdminRole.Viewer}>Viewer</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

/** Ubah peran — enum tetap → Select. */
function CommitteeRoleSelectField(props: {
  htmlId: string;
  initialRole: string;
  disabled: boolean;
}) {
  const [role, setRole] = useState(props.initialRole);

  return (
    <>
      <input type="hidden" name="role" value={role} />
      <Select
        value={role}
        onValueChange={(v) => {
          if (v != null) setRole(v);
        }}
        disabled={props.disabled}
      >
        <SelectTrigger id={props.htmlId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Owner">Owner</SelectItem>
          <SelectItem value="Admin">Admin</SelectItem>
          <SelectItem value="Verifier">Verifier</SelectItem>
          <SelectItem value="Viewer">Viewer</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

/** Banyak pengurus → EntityCombobox (cari/filter). */
function CommitteeManagementMemberCombobox(props: {
  htmlId: string;
  initialManagementMemberId: string | null;
  memberOptions: CommitteeAdminDirectoryVm["memberOptions"];
  disabled: boolean;
}) {
  const comboOptions = useMemo(
    () =>
      props.memberOptions.map((o) => ({
        value: o.id,
        label: o.label,
      })),
    [props.memberOptions],
  );

  const [managementMemberId, setManagementMemberId] = useState<string | null>(
    props.initialManagementMemberId ?? null,
  );

  return (
    <>
      <input
        type="hidden"
        name="managementMemberId"
        value={managementMemberId ?? ""}
      />
      <EntityCombobox
        id={props.htmlId}
        placeholder="— Tidak dikaitkan"
        value={managementMemberId}
        onValueChange={setManagementMemberId}
        options={comboOptions}
        disabled={props.disabled}
      />
    </>
  );
}

function InviteAdminForm({ onCloseDialog }: { onCloseDialog: () => void }) {
  const emailedSentRef = useRef(false);

  const [inviteState, inviteDispatch, invitePending] = useActionState(
    createAdminInvitation,
    null as ActionResult<CreateAdminInvitationResult> | null,
  );

  useEffect(() => {
    if (!inviteState?.ok) return;
    if (inviteState.data.inviteUrl) return;
    if (emailedSentRef.current) return;
    emailedSentRef.current = true;
    toastCudSuccess("create", "Undangan dibuat — email undangan telah dikirim.");
    onCloseDialog();
  }, [inviteState, onCloseDialog]);

  const inviteFieldLines = fieldErrorsLines(
    inviteState?.ok === false ? inviteState.fieldErrors : undefined,
  );

  if (inviteState?.ok === true && inviteState.data.inviteUrl) {
    const url = inviteState.data.inviteUrl;
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Salin taut undangan</AlertTitle>
          <AlertDescription>
            Email pengiriman tidak digunakan atau gagal — berikan taut ini secara langsung kepada
            penerima (rahasia, satu orang).
          </AlertDescription>
        </Alert>
        <Input readOnly value={url} className="font-mono text-xs" />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(
                () => toast.success("Taut disalin."),
                () => toast.error("Salin gagal — pilih manual."),
              );
            }}
          >
            Salin taut
          </Button>
          <Button type="button" variant="outline" onClick={() => onCloseDialog()}>
            Tutup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={inviteDispatch} className="space-y-4">
      {inviteState?.ok === false && inviteState.rootError ? (
        <Alert variant="destructive">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{inviteState.rootError}</AlertDescription>
        </Alert>
      ) : null}
      {inviteFieldLines ? (
        <Alert variant="destructive">
          <AlertTitle>Periksa isian</AlertTitle>
          <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
            {inviteFieldLines}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="invite-admin-email">Email</Label>
        <Input
          id="invite-admin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={invitePending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-admin-role">Peran pertama</Label>
        <InviteInviteeRoleSelect disabled={invitePending} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={invitePending}>
          {invitePending ? <Loader2 className="size-4 animate-spin" /> : "Kirim undangan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RevokeInvitationForm(props: { invitationId: string }) {
  const router = useRouter();
  const revokedRef = useRef(false);

  const [revokeInvState, revokeInvDispatch, revokeInvPending] = useActionState(
    revokeAdminInvitation,
    null as ActionResult<{ revoked: true }> | null,
  );

  useEffect(() => {
    if (!revokeInvState?.ok || revokedRef.current) return;
    revokedRef.current = true;
    toast.success("Undangan dibatalkan.");
    router.refresh();
  }, [revokeInvState, router]);

  return (
    <form action={revokeInvDispatch} className="inline">
      <input type="hidden" name="invitationId" value={props.invitationId} />
      <Button type="submit" variant="outline" size="sm" disabled={revokeInvPending}>
        Batalkan
      </Button>
    </form>
  );
}

type ManageDialogId = "role" | "member" | "revoke" | "delete";

type ManageFormsProps = {
  row: CommitteeAdminDirectoryRowVm;
  memberOptions: CommitteeAdminDirectoryVm["memberOptions"];
  onAnySuccess: () => void;
  manageKey: number;
};

function ManageAdminDialogs(props: ManageFormsProps) {
  const { row, onAnySuccess } = props;
  const [activeDialog, setActiveDialog] = useState<ManageDialogId | null>(null);

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
  const [deleteState, deleteDispatch, deletePending] = useActionState(
    deleteCommitteeAdmin,
    null as ActionResult<{ deleted: true }> | null,
  );

  useEffect(() => {
    if (roleState?.ok || memberState?.ok || revokeState?.ok || deleteState?.ok) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- sync controlled dialog closed after action success */
      setActiveDialog(null);
      onAnySuccess();
    }
  }, [roleState?.ok, memberState?.ok, revokeState?.ok, deleteState?.ok, onAnySuccess]);

  useEffect(() => {
    if (roleState?.ok) toastCudSuccess("update", "Peran admin diperbarui.");
  }, [roleState]);

  useEffect(() => {
    if (memberState?.ok)
      toastCudSuccess("update", "Tautan anggota admin diperbarui.");
  }, [memberState]);

  useEffect(() => {
    if (revokeState?.ok) toastCudSuccess("update", "Akses admin dicabut.");
  }, [revokeState]);

  useEffect(() => {
    if (deleteState?.ok) toastCudSuccess("delete", "Admin komite dihapus.");
  }, [deleteState]);

  const flagLinesRole = fieldErrorsLines(
    roleState?.ok === false ? roleState.fieldErrors : undefined,
  );
  const flagLinesMember = fieldErrorsLines(
    memberState?.ok === false ? memberState.fieldErrors : undefined,
  );
  const flagLinesRevoke = fieldErrorsLines(
    revokeState?.ok === false ? revokeState.fieldErrors : undefined,
  );

  const actionDisabled =
    rolePending || memberPending || revokePending || deletePending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Aksi untuk ${row.email}`}
          disabled={actionDisabled}
          render={<Button variant="outline" size="icon-sm" />}
        >
          <MoreVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={rolePending}
            onClick={() => setActiveDialog("role")}
          >
            Ubah peran
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={memberPending}
            onClick={() => setActiveDialog("member")}
          >
            Tautan anggota
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={revokePending}
            onClick={() => setActiveDialog("revoke")}
          >
            Cabut akses
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={deletePending}
            onClick={() => setActiveDialog("delete")}
          >
            Hapus profil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={activeDialog === "role"}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null);
        }}
      >
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
              <CommitteeRoleSelectField
                htmlId={`role-${row.adminProfileId}`}
                initialRole={row.role}
                disabled={rolePending}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={rolePending}>
                {rolePending ? <Loader2 className="size-4 animate-spin" /> : "Simpan peran"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === "member"}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hubungkan ke MasterMember</DialogTitle>
            <DialogDescription>
              Opsional. Untuk bantuan operasional, hubungkan admin ke baris direktori. PIC acara dan
              rekening terkait dikonfigurasi lewat profil admin (bukan lewat flag di Anggota).
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
              <Label htmlFor={`member-${row.adminProfileId}`}>Pengurus</Label>
              <CommitteeManagementMemberCombobox
                htmlId={`member-${row.adminProfileId}`}
                initialManagementMemberId={row.managementMemberId ?? null}
                memberOptions={props.memberOptions}
                disabled={memberPending}
              />
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

      <Dialog
        open={activeDialog === "revoke"}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null);
        }}
      >
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

      <Dialog
        open={activeDialog === "delete"}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus profil admin</DialogTitle>
            <DialogDescription>
              Menghapus profil dan akun masuk untuk <strong>{row.email}</strong>{" "}
              secara permanen. Alamat email itu tidak lagi bisa digunakan untuk
              masuk admin sampai Owner mengundang lagi sebagai admin baru. Tidak bisa
              dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {deleteState?.ok === false && deleteState.rootError ? (
            <Alert variant="destructive">
              <AlertTitle>Gagal</AlertTitle>
              <AlertDescription>{deleteState.rootError}</AlertDescription>
            </Alert>
          ) : null}
          <form
            action={deleteDispatch}
            key={`d-${props.manageKey}-${row.adminProfileId}`}
          >
            <input type="hidden" name="adminProfileId" value={row.adminProfileId} />
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={deletePending}>
                {deletePending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Ya, hapus profil & akun"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CommitteeAdminSettingsPanel(props: {
  viewerProfileId: string;
  viewerRole: AdminRole;
  directory: CommitteeAdminDirectoryVm;
  pendingInvitations: PendingAdminInvitationRowVm[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteFormKey, setInviteFormKey] = useState(0);
  const [manageKey, setManageKey] = useState(0);
  const [expandedPicProfileId, setExpandedPicProfileId] = useState<string | null>(
    null,
  );

  const canInvite = viewerMayUseOwnerOnlyCommitteeControls(props.viewerRole);

  const onManageSuccess = useCallback(() => {
    setManageKey((k) => k + 1);
    router.refresh();
  }, [router]);

  const closeInviteDialog = useCallback(() => {
    setInviteOpen(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Admin terdaftar</h2>
        {canInvite ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/settings/committee/export"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Unduh CSV
            </Link>
            <Dialog
              open={inviteOpen}
              onOpenChange={(o) => {
                setInviteOpen(o);
                if (o) setInviteFormKey((k) => k + 1);
              }}
            >
              <DialogTrigger render={<Button variant="default" />}>Undang admin baru…</DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Undang admin baru</DialogTitle>
                  <DialogDescription>
                    Untuk email yang belum punya akun pengguna. Penerima mendapat taut untuk menetapkan nama
                    dan kata sandi lewat halaman onboarding.
                  </DialogDescription>
                </DialogHeader>
                <InviteAdminForm key={inviteFormKey} onCloseDialog={closeInviteDialog} />
              </DialogContent>
            </Dialog>
          </div>
        ) : null}
      </div>

      {canInvite ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Undangan tertunda</h3>
          {props.pendingInvitations.length === 0 ? (
            <p className="text-muted-foreground text-sm">Tidak ada undangan yang menunggu.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Status / kedaluwarsa</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.pendingInvitations.map((row) => {
                    const expired = row.isExpired;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs sm:text-sm">
                          {row.emailNormalized}
                        </TableCell>
                        <TableCell>{ROLE_LABELS[row.role] ?? row.role}</TableCell>
                        <TableCell className="text-sm">
                          {expired ? (
                            <span className="text-destructive">Kedaluwarsa</span>
                          ) : (
                            <span className="text-muted-foreground">
                              Aktif sampai {formatInviteExpiry(row.expiresAtIso)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <RevokeInvitationForm key={row.id} invitationId={row.id} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground w-14">
                <span className="sr-only">Expand rekening</span>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Anggota terkait</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>Aktivitas sesi*</TableHead>
              <TableHead className="whitespace-nowrap text-right tabular-nums">
                Acara (PIC)
              </TableHead>
              <TableHead className="whitespace-nowrap text-right tabular-nums">
                Rek. PIC
              </TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.directory.rows.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={10}>
                  Belum ada AdminProfile.
                </TableCell>
              </TableRow>
            ) : (
              props.directory.rows.map((row) => (
                <Fragment key={row.adminProfileId}>
                  <TableRow>
                    <TableCell className="w-14 align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="-ms-2"
                        aria-expanded={expandedPicProfileId === row.adminProfileId}
                        aria-controls={`committee-pic-banks-${row.adminProfileId}`}
                        aria-label={`Rekening PIC untuk ${row.email}`}
                        onClick={() => {
                          setExpandedPicProfileId((cur) =>
                            cur === row.adminProfileId ? null : row.adminProfileId,
                          );
                        }}
                      >
                        {expandedPicProfileId === row.adminProfileId ? (
                          <ChevronDown />
                        ) : (
                          <ChevronRight />
                        )}
                      </Button>
                    </TableCell>
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
                  <TableCell className="text-right tabular-nums text-xs">
                    {row.eventPicCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {row.picBankAccountOwnedCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {canInvite ? (
                      <ManageAdminDialogs
                        row={row}
                        memberOptions={props.directory.memberOptions}
                        manageKey={manageKey}
                        onAnySuccess={onManageSuccess}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
                  {expandedPicProfileId === row.adminProfileId ? (
                    <TableRow key={`${row.adminProfileId}-pic`}>
                      <TableCell className="bg-muted/20 p-0" colSpan={10}>
                        <div
                          className="px-4 pb-4"
                          id={`committee-pic-banks-${row.adminProfileId}`}
                        >
                          <AdminPicBankAccountsInline
                            key={`banks-${manageKey}-${row.adminProfileId}`}
                            ownerAdminProfileId={row.adminProfileId}
                            viewerProfileId={props.viewerProfileId}
                            viewerRole={props.viewerRole}
                            accounts={row.picBankAccounts}
                            onMutationSuccess={onManageSuccess}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
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
