"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "@prisma/client";

import type { CommitteeAdminDetailVm } from "@/lib/admin/load-committee-admin-detail";
import {
  deleteCommitteeAdmin,
  revokeCommitteeAdminMeaningfulAccess,
  updateCommitteeAdminMemberLink,
  updateCommitteeAdminRole,
} from "@/lib/actions/admin-committee-profiles";
import { AdminPicBankAccountsInline } from "@/components/admin/admin-pic-bank-accounts-inline";
import { CommitteeAdminPicEventsTab } from "@/components/admin/committee-admin-pic-events-tab";
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
} from "@/components/ui/dialog";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { ActionResult } from "@/lib/forms/action-result";
import { toastCudSuccess } from "@/lib/client/cud-notify";

type ActiveDialog = "role" | "member" | "revoke" | "delete" | null;

function fieldErrorsLines(fieldErrors?: Record<string, string>) {
  if (!fieldErrors || Object.keys(fieldErrors).length === 0) return null;
  return Object.entries(fieldErrors)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function RoleSelectField(props: {
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

function MemberComboboxField(props: {
  htmlId: string;
  initialManagementMemberId: string | null;
  memberOptions: { id: string; label: string }[];
  disabled: boolean;
}) {
  const comboOptions = useMemo(
    () => props.memberOptions.map((o) => ({ value: o.id, label: o.label })),
    [props.memberOptions],
  );
  const [value, setValue] = useState<string | null>(props.initialManagementMemberId);
  return (
    <>
      <input type="hidden" name="managementMemberId" value={value ?? ""} />
      <EntityCombobox
        id={props.htmlId}
        placeholder="— Tidak dikaitkan"
        value={value}
        onValueChange={setValue}
        options={comboOptions}
        disabled={props.disabled}
      />
    </>
  );
}

const SESSION_FMT = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "short",
  timeStyle: "short",
});

export function CommitteeAdminDetailTabs(props: {
  detail: CommitteeAdminDetailVm;
  viewerProfileId: string;
  viewerRole: AdminRole;
}) {
  const { detail } = props;
  const router = useRouter();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [dialogKey, setDialogKey] = useState(0);

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
    if (deleteState?.ok) {
      setActiveDialog(null);
      setDialogKey((k) => k + 1);
      router.push("/admin/settings/committee");
      return;
    }
    if (roleState?.ok || memberState?.ok || revokeState?.ok) {
      setActiveDialog(null);
      setDialogKey((k) => k + 1);
      router.refresh();
    }
  }, [roleState?.ok, memberState?.ok, revokeState?.ok, deleteState?.ok, router]);

  useEffect(() => {
    if (roleState?.ok) toastCudSuccess("update", "Peran admin diperbarui.");
  }, [roleState]);
  useEffect(() => {
    if (memberState?.ok) toastCudSuccess("update", "Tautan anggota diperbarui.");
  }, [memberState]);
  useEffect(() => {
    if (revokeState?.ok) toastCudSuccess("update", "Akses admin dicabut.");
  }, [revokeState]);
  useEffect(() => {
    if (deleteState?.ok) toastCudSuccess("delete", "Admin komite dihapus.");
  }, [deleteState]);

  const onBankSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const actionDisabled = rolePending || memberPending || revokePending || deletePending;

  return (
    <Tabs defaultValue="profil" className="space-y-4">
      <TabsList>
        <TabsTrigger value="profil">Profil & Aksi</TabsTrigger>
        <TabsTrigger value="rekening">
          Rekening PIC ({detail.picBankAccounts.length})
        </TabsTrigger>
        <TabsTrigger value="acara">
          Acara PIC ({detail.eventsAsPic.length})
        </TabsTrigger>
      </TabsList>

      {/* ── Tab 1: Profil & Aksi ── */}
      <TabsContent value="profil" className="space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Peran</p>
            <p>{detail.role}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Anggota terkait</p>
            <p>{detail.memberSummary ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">2FA</p>
            <p>{detail.twoFactorEnabled ? "Aktif" : "Tidak aktif"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Aktivitas sesi*</p>
            <p className="text-xs">
              {detail.lastSessionActivityAtIso
                ? SESSION_FMT.format(new Date(detail.lastSessionActivityAtIso))
                : "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={actionDisabled}
            onClick={() => setActiveDialog("role")}
          >
            Ubah peran
          </Button>
          <Button
            variant="outline"
            disabled={actionDisabled}
            onClick={() => setActiveDialog("member")}
          >
            Tautan anggota
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={actionDisabled}
            onClick={() => setActiveDialog("revoke")}
          >
            Cabut akses
          </Button>
          <Button
            variant="destructive"
            disabled={actionDisabled}
            onClick={() => setActiveDialog("delete")}
          >
            Hapus profil & akun
          </Button>
        </div>

        {/* Dialog: Ubah peran */}
        <Dialog
          open={activeDialog === "role"}
          onOpenChange={(o) => {
            if (!o) setActiveDialog(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ubah peran admin</DialogTitle>
              <DialogDescription>
                {detail.email} — peran baru berlaku segera setelah disimpan.
              </DialogDescription>
            </DialogHeader>
            <form action={roleDispatch} className="space-y-4" key={`r-${dialogKey}`}>
              <input type="hidden" name="adminProfileId" value={detail.adminProfileId} />
              {roleState?.ok === false && roleState.rootError ? (
                <Alert variant="destructive">
                  <AlertTitle>Gagal</AlertTitle>
                  <AlertDescription>{roleState.rootError}</AlertDescription>
                </Alert>
              ) : null}
              {fieldErrorsLines(
                roleState?.ok === false ? roleState.fieldErrors : undefined,
              ) ? (
                <Alert variant="destructive">
                  <AlertTitle>Periksa isian</AlertTitle>
                  <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                    {fieldErrorsLines(
                      roleState?.ok === false ? roleState.fieldErrors : undefined,
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="detail-role-select">Peran</Label>
                <RoleSelectField
                  htmlId="detail-role-select"
                  initialRole={detail.role}
                  disabled={rolePending}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={rolePending}>
                  {rolePending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Simpan peran"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Tautan anggota */}
        <Dialog
          open={activeDialog === "member"}
          onOpenChange={(o) => {
            if (!o) setActiveDialog(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Hubungkan ke MasterMember</DialogTitle>
              <DialogDescription>
                Opsional. PIC acara dan rekening dikonfigurasi lewat profil admin (bukan lewat flag
                di Anggota).
              </DialogDescription>
            </DialogHeader>
            <form action={memberDispatch} className="space-y-4" key={`m-${dialogKey}`}>
              <input type="hidden" name="adminProfileId" value={detail.adminProfileId} />
              {memberState?.ok === false && memberState.rootError ? (
                <Alert variant="destructive">
                  <AlertTitle>Gagal</AlertTitle>
                  <AlertDescription>{memberState.rootError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="detail-member-combo">Pengurus</Label>
                <MemberComboboxField
                  htmlId="detail-member-combo"
                  initialManagementMemberId={detail.managementMemberId}
                  memberOptions={detail.memberOptions}
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

        {/* Dialog: Cabut akses */}
        <Dialog
          open={activeDialog === "revoke"}
          onOpenChange={(o) => {
            if (!o) setActiveDialog(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cabut akses bermakna</DialogTitle>
              <DialogDescription>
                Mengatur peran menjadi Viewer dan menghapus tautan anggota untuk{" "}
                <strong>{detail.email}</strong>. Profil tidak dihapus.
              </DialogDescription>
            </DialogHeader>
            {revokeState?.ok === false && revokeState.rootError ? (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{revokeState.rootError}</AlertDescription>
              </Alert>
            ) : null}
            <form action={revokeDispatch} key={`v-${dialogKey}`}>
              <input type="hidden" name="adminProfileId" value={detail.adminProfileId} />
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

        {/* Dialog: Hapus profil */}
        <Dialog
          open={activeDialog === "delete"}
          onOpenChange={(o) => {
            if (!o) setActiveDialog(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus profil admin</DialogTitle>
              <DialogDescription>
                Menghapus profil dan akun masuk untuk <strong>{detail.email}</strong> secara
                permanen. Tidak bisa dibatalkan.
              </DialogDescription>
            </DialogHeader>
            {deleteState?.ok === false && deleteState.rootError ? (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{deleteState.rootError}</AlertDescription>
              </Alert>
            ) : null}
            <form action={deleteDispatch} key={`d-${dialogKey}`}>
              <input type="hidden" name="adminProfileId" value={detail.adminProfileId} />
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

        <p className="text-muted-foreground text-xs">
          * Berdasarkan sesi aktif yang belum kedaluwarsa.
        </p>
      </TabsContent>

      {/* ── Tab 2: Rekening PIC ── */}
      <TabsContent value="rekening">
        <AdminPicBankAccountsInline
          key={`banks-${dialogKey}`}
          ownerAdminProfileId={detail.adminProfileId}
          viewerProfileId={props.viewerProfileId}
          viewerRole={props.viewerRole}
          accounts={detail.picBankAccounts}
          onMutationSuccess={onBankSuccess}
        />
      </TabsContent>

      {/* ── Tab 3: Acara PIC ── */}
      <TabsContent value="acara">
        <CommitteeAdminPicEventsTab events={detail.eventsAsPic} />
      </TabsContent>
    </Tabs>
  );
}
