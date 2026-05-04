"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminRole } from "@prisma/client";
import type { VariantProps } from "class-variance-authority";

import type {
  CommitteeAdminDirectoryRowVm,
  CommitteeAdminDirectoryVm,
} from "@/lib/admin/load-committee-admin-directory";
import type { PendingAdminInvitationRowVm } from "@/lib/admin/load-pending-admin-invitations";
import {
  createAdminInvitation,
  revokeAdminInvitation,
  type CreateAdminInvitationResult,
} from "@/lib/actions/admin-admin-invitations";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/lib/forms/action-result";
import { toastCudSuccess } from "@/lib/client/cud-notify";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const ROLE_LABELS: Record<string, string> = {
  Owner: "Owner",
  Admin: "Admin",
  Verifier: "Verifier",
  Viewer: "Viewer",
};

const ROLE_BADGE_VARIANT: Record<string, BadgeVariant> = {
  Owner: "default",
  Admin: "secondary",
  Verifier: "outline",
  Viewer: "outline",
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

function fieldErrorsLines(fieldErrors?: Record<string, string>) {
  if (!fieldErrors || Object.keys(fieldErrors).length === 0) return null;
  return Object.entries(fieldErrors)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

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

export function CommitteeAdminSettingsPanel(props: {
  directory: CommitteeAdminDirectoryVm;
  pendingInvitations: PendingAdminInvitationRowVm[];
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteFormKey, setInviteFormKey] = useState(0);

  const closeInviteDialog = useCallback(() => setInviteOpen(false), []);

  const adminColumns = useMemo<ColumnDef<CommitteeAdminDirectoryRowVm>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="font-mono text-xs sm:text-sm">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "displayName",
        header: "Nama",
      },
      {
        accessorKey: "role",
        header: "Peran",
        filterFn: "equals",
        cell: ({ row }) => (
          <Badge variant={ROLE_BADGE_VARIANT[row.original.role] ?? "outline"}>
            {ROLE_LABELS[row.original.role] ?? row.original.role}
          </Badge>
        ),
      },
      {
        accessorKey: "lastSessionActivityAtIso",
        header: "Aktivitas sesi*",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">
            {formatSessionHint(row.original.lastSessionActivityAtIso)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/admin/settings/committee/${row.original.adminProfileId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Detail →
          </Link>
        ),
      },
    ],
    [],
  );

  const invitationColumns = useMemo<ColumnDef<PendingAdminInvitationRowVm>[]>(
    () => [
      {
        accessorKey: "emailNormalized",
        header: "Email",
        cell: ({ row }) => (
          <span className="font-mono text-xs sm:text-sm">{row.original.emailNormalized}</span>
        ),
      },
      {
        accessorKey: "role",
        header: "Peran",
        cell: ({ row }) => ROLE_LABELS[row.original.role] ?? row.original.role,
      },
      {
        id: "status",
        header: "Status / kedaluwarsa",
        enableSorting: false,
        filterFn: (_row, _columnId, filterValue: string) => {
          if (filterValue === "expired") return _row.original.isExpired;
          if (filterValue === "active") return !_row.original.isExpired;
          return true;
        },
        cell: ({ row }) =>
          row.original.isExpired ? (
            <span className="text-destructive text-sm">Kedaluwarsa</span>
          ) : (
            <span className="text-muted-foreground text-sm">
              Aktif sampai {formatInviteExpiry(row.original.expiresAtIso)}
            </span>
          ),
      },
      {
        id: "inv-actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-right">
            <RevokeInvitationForm key={row.original.id} invitationId={row.original.id} />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Admin terdaftar</h2>
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
            <DialogTrigger render={<Button variant="default" />}>
              Undang admin baru…
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Undang admin baru</DialogTitle>
                <DialogDescription>
                  Untuk email yang belum punya akun pengguna. Penerima mendapat taut untuk menetapkan
                  nama dan kata sandi lewat halaman onboarding.
                </DialogDescription>
              </DialogHeader>
              <InviteAdminForm key={inviteFormKey} onCloseDialog={closeInviteDialog} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Undangan tertunda</h3>
        {props.pendingInvitations.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tidak ada undangan yang menunggu.</p>
        ) : (
          <DataTable
            columns={invitationColumns}
            data={props.pendingInvitations}
            emptyMessage="Tidak ada undangan tertunda."
            enableSorting={false}
            filterSelectColumn="status"
            filterSelectOptions={[
              { label: "Aktif", value: "active" },
              { label: "Kedaluwarsa", value: "expired" },
            ]}
            filterSelectAllLabel="Semua status"
            enablePagination
            pageSize={10}
          />
        )}
      </div>

      <DataTable
        columns={adminColumns}
        data={props.directory.rows}
        emptyMessage="Belum ada AdminProfile."
        enableGlobalFilter
        globalFilterPlaceholder="Cari nama atau email..."
        filterSelectColumn="role"
        filterSelectOptions={[
          { label: "Owner", value: "Owner" },
          { label: "Admin", value: "Admin" },
          { label: "Verifier", value: "Verifier" },
          { label: "Viewer", value: "Viewer" },
        ]}
        filterSelectAllLabel="Semua peran"
        enablePagination
        pageSize={10}
      />

      <p className="text-muted-foreground text-xs leading-relaxed">
        <span className="font-medium text-foreground">*</span> Berdasarkan sesi aktif yang belum
        kedaluwarsa (pembaruan terbaru dari tabel sesi Better Auth). Untuk rekonsiliasi lebih
        lengkap pakai Pengaturan →{" "}
        <Link href="/admin/settings/security" className="underline underline-offset-4">
          Keamanan
        </Link>{" "}
        (log audit). Darurat penyediaan akun baru masih bisa lewat CLI{" "}
        <code className="font-mono text-[11px]">pnpm bootstrap:admin</code>.
      </p>
    </div>
  );
}
