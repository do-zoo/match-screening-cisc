"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import type { AdminRole } from "@prisma/client";
import { Loader2 } from "lucide-react";

import type { CommitteeAdminDirectoryPicBankVm } from "@/lib/admin/load-committee-admin-directory";
import { canMutatePicBankForTarget } from "@/lib/admin/pic-bank-account-permissions";
import {
  createPicBankAccount,
  deactivatePicBankAccount,
  deletePicBankAccountPermanent,
  updatePicBankAccount,
} from "@/lib/actions/admin-pic-bank-accounts";
import { Badge } from "@/components/ui/badge";
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
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
import type { ActionResult } from "@/lib/forms/action-result";

export type AdminPicBankAccountsInlineProps = {
  ownerAdminProfileId: string;
  viewerProfileId: string;
  viewerRole: AdminRole;
  accounts: CommitteeAdminDirectoryPicBankVm[];
  /** Called after ok mutation (parent may router.refresh). */
  onMutationSuccess?: () => void;
};

export function AdminPicBankAccountsInline(props: AdminPicBankAccountsInlineProps) {
  const uiId = useId();
  const { onMutationSuccess } = props;
  const canMutate = useMemo(
    () =>
      canMutatePicBankForTarget(
        props.viewerRole,
        props.viewerProfileId,
        props.ownerAdminProfileId,
      ),
    [
      props.viewerRole,
      props.viewerProfileId,
      props.ownerAdminProfileId,
    ],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editAccount, setEditAccount] =
    useState<CommitteeAdminDirectoryPicBankVm | null>(null);
  const [deactivateAccount, setDeactivateAccount] =
    useState<CommitteeAdminDirectoryPicBankVm | null>(null);
  const [deleteAccount, setDeleteAccount] =
    useState<CommitteeAdminDirectoryPicBankVm | null>(null);

  const [createState, createDispatch, createPending] = useActionState(
    createPicBankAccount,
    null as ActionResult<{ id: string }> | null,
  );

  const [updateState, updateDispatch, updatePending] = useActionState(
    updatePicBankAccount,
    null as ActionResult<{ saved: true }> | null,
  );

  const [deactivateState, deactivateDispatch, deactivatePending] =
    useActionState(
      deactivatePicBankAccount,
      null as ActionResult<{ saved: true }> | null,
    );

  const [deleteState, deleteDispatch, deletePending] = useActionState(
    deletePicBankAccountPermanent,
    null as ActionResult<{ deleted: true }> | null,
  );

  useEffect(() => {
    if (!createState) return;
    if (createState.ok) {
      toastCudSuccess("create", "Rekening PIC ditambahkan.");
      queueMicrotask(() => setAddOpen(false));
      onMutationSuccess?.();
    } else toastActionErr(createState);
  }, [createState, onMutationSuccess]);

  useEffect(() => {
    if (!updateState) return;
    if (updateState.ok) {
      toastCudSuccess("update", "Rekening PIC diperbarui.");
      queueMicrotask(() => setEditAccount(null));
      onMutationSuccess?.();
    } else toastActionErr(updateState);
  }, [updateState, onMutationSuccess]);

  useEffect(() => {
    if (!deactivateState) return;
    if (deactivateState.ok) {
      toastCudSuccess("update", "Rekening dinonaktifkan.");
      queueMicrotask(() => setDeactivateAccount(null));
      onMutationSuccess?.();
    } else toastActionErr(deactivateState);
  }, [deactivateState, onMutationSuccess]);

  useEffect(() => {
    if (!deleteState) return;
    if (deleteState.ok) {
      toastCudSuccess("delete", "Rekening dihapus.");
      queueMicrotask(() => setDeleteAccount(null));
      onMutationSuccess?.();
    } else toastActionErr(deleteState);
  }, [deleteState, onMutationSuccess]);

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-foreground font-medium">Rekening pembayaran (PIC)</h4>
        {canMutate ? (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              Tambah rekening…
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Rekening baru</DialogTitle>
                <DialogDescription>
                  Rekening digunakan saat PIC dipilih sebagai penanggung pembayaran acara.
                </DialogDescription>
              </DialogHeader>
              <form
                action={createDispatch}
                className="space-y-3"
                key={`pb-add-${props.ownerAdminProfileId}`}
              >
                <input type="hidden" name="ownerAdminProfileId" value={props.ownerAdminProfileId} />
                <div className="space-y-2">
                  <Label htmlFor={`${uiId}-bank`}>Nama bank</Label>
                  <Input id={`${uiId}-bank`} name="bankName" required disabled={createPending} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${uiId}-acct`}>Nomor rekening</Label>
                  <Input id={`${uiId}-acct`} name="accountNumber" required disabled={createPending} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${uiId}-nm`}>Nama pemilik rekening</Label>
                  <Input id={`${uiId}-nm`} name="accountName" required disabled={createPending} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createPending}>
                    {createPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Simpan rekening"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {props.accounts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Belum ada rekening PIC untuk profil ini.
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-lg border">
          {props.accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground text-sm font-medium">{a.bankName}</span>
                  {a.isActive ? (
                    <Badge variant="default" className="text-xs">
                      Aktif
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Nonaktif
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-muted-foreground text-xs break-all">{a.accountNumber}</p>
                <p className="text-muted-foreground text-xs">{a.accountName}</p>
              </div>
              {canMutate ? (
                <div className="flex flex-wrap gap-2">
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setEditAccount(a)}
                    >
                      Ubah…
                    </Button>
                    <Dialog
                      open={editAccount?.id === a.id}
                      onOpenChange={(open) => {
                        if (!open) setEditAccount(null);
                      }}
                    >
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Ubah rekening</DialogTitle>
                        </DialogHeader>
                        <form action={updateDispatch} className="space-y-3">
                          <input type="hidden" name="bankAccountId" value={a.id} />
                          <input
                            type="hidden"
                            name="ownerAdminProfileId"
                            value={props.ownerAdminProfileId}
                          />
                          <div className="space-y-2">
                            <Label htmlFor={`${uiId}-edit-b-${a.id}`}>Nama bank</Label>
                            <Input
                              id={`${uiId}-edit-b-${a.id}`}
                              name="bankName"
                              defaultValue={a.bankName}
                              required
                              disabled={updatePending}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${uiId}-edit-n-${a.id}`}>Nomor rekening</Label>
                            <Input
                              id={`${uiId}-edit-n-${a.id}`}
                              name="accountNumber"
                              defaultValue={a.accountNumber}
                              required
                              disabled={updatePending}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${uiId}-edit-a-${a.id}`}>Nama pemilik rekening</Label>
                            <Input
                              id={`${uiId}-edit-a-${a.id}`}
                              name="accountName"
                              defaultValue={a.accountName}
                              required
                              disabled={updatePending}
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={updatePending}>
                              {updatePending ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                "Simpan"
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </>

                  {a.isActive ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        className="bg-transparent"
                        onClick={() => setDeactivateAccount(a)}
                      >
                        Nonaktifkan…
                      </Button>
                      <Dialog
                        open={deactivateAccount?.id === a.id}
                        onOpenChange={(open) => {
                          if (!open) setDeactivateAccount(null);
                        }}
                      >
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Nonaktifkan rekening</DialogTitle>
                            <DialogDescription>
                              Acara yang sudah menggunakan rekening ini tetap terpasang. Acara baru
                              harus memilih rekening aktif lain bagi PIC tersebut.
                            </DialogDescription>
                          </DialogHeader>
                          <form action={deactivateDispatch} className="space-y-3">
                            <input type="hidden" name="bankAccountId" value={a.id} />
                            <input
                              type="hidden"
                              name="ownerAdminProfileId"
                              value={props.ownerAdminProfileId}
                            />
                            <DialogFooter>
                              <Button type="submit" variant="destructive" disabled={deactivatePending}>
                                {deactivatePending ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  "Nonaktifkan"
                                )}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </>
                  ) : null}

                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      type="button"
                      className="bg-transparent"
                      onClick={() => setDeleteAccount(a)}
                    >
                      Hapus…
                    </Button>
                    <Dialog
                      open={deleteAccount?.id === a.id}
                      onOpenChange={(open) => {
                        if (!open) setDeleteAccount(null);
                      }}
                    >
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Hapus rekening</DialogTitle>
                          <DialogDescription>
                            Hanya diperbolehkan jika tidak ada acara yang memakai rekening ini.
                            Jika masih dipakai, gunakan nonaktif atau ganti rekening di acara.
                          </DialogDescription>
                        </DialogHeader>
                        <form action={deleteDispatch} className="space-y-3">
                          <input type="hidden" name="bankAccountId" value={a.id} />
                          <input
                            type="hidden"
                            name="ownerAdminProfileId"
                            value={props.ownerAdminProfileId}
                          />
                          <DialogFooter>
                            <Button type="submit" variant="destructive" disabled={deletePending}>
                              {deletePending ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                "Hapus permanen"
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
