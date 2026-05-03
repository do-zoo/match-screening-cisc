"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { deleteMasterMember } from "@/lib/actions/admin-master-members";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminMasterMemberRowVm } from "@/lib/members/query-admin-master-members";

type Props = {
  member: AdminMasterMemberRowVm | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful delete; parent should refresh and clear related UI state. */
  onDeleted: (deletedId: string) => void;
};

export function MemberDeleteDialog({
  member,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  function handleConfirm() {
    if (!member) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("memberId", member.id);
      const result = await deleteMasterMember(undefined, fd);
      if (result.ok) {
        toastCudSuccess("delete", "Anggota berhasil dihapus.");
        onOpenChange(false);
        onDeleted(member.id);
      } else {
        toastActionErr(result, "Gagal menghapus anggota.");
        setError(result.rootError ?? "Gagal menghapus anggota.");
      }
    });
  }

  const name = member?.fullName ?? "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus anggota</DialogTitle>
          <DialogDescription>
            Hapus <strong>{name}</strong> secara permanen? Tindakan ini tidak
            bisa dibatalkan.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending || !member}
            onClick={handleConfirm}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Ya, hapus anggota"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
