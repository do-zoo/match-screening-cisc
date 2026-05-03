"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBoardAssignment,
  deleteBoardAssignment,
  updateBoardAssignment,
} from "@/lib/actions/admin-board-assignments";
import {
  adminBoardAssignmentUpsertSchema,
  adminBoardAssignmentUpdateSchema,
} from "@/lib/forms/admin-board-assignment-schema";

type MemberOption = { id: string; fullName: string; publicCode: string };
type RoleOption = { id: string; title: string };

type AssignmentRow = {
  id: string;
  boardRole: { id: string; title: string };
  managementMember: { id: string; fullName: string; publicCode: string };
};

type CreateProps = {
  mode: "create";
  boardPeriodId: string;
  availableMembers: MemberOption[];
  availableRoles: RoleOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

type EditProps = {
  mode: "edit";
  boardPeriodId: string;
  assignment: AssignmentRow;
  availableRoles: RoleOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  defaultShowDeleteConfirm?: boolean;
};

type Props = CreateProps | EditProps;

type CreateFormValues = {
  boardPeriodId: string;
  managementMemberId: string;
  boardRoleId: string;
};

type EditFormValues = {
  id: string;
  boardPeriodId: string;
  managementMemberId: string;
  boardRoleId: string;
};

export function ManagementAssignmentFormDialog(props: Props) {
  const [isPending, startTransition] = useTransition();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const defaultShowDeleteConfirm = props.mode === "edit" ? (props.defaultShowDeleteConfirm ?? false) : false;

  const defaultValues = useMemo(() => {
    if (props.mode === "create") {
      return {
        boardPeriodId: props.boardPeriodId,
        managementMemberId: "",
        boardRoleId: "",
      } as CreateFormValues;
    }
    return {
      id: props.assignment.id,
      boardPeriodId: props.boardPeriodId,
      managementMemberId: props.assignment.managementMember.id,
      boardRoleId: props.assignment.boardRole.id,
    } as EditFormValues;
  }, [props]);

  const schema =
    props.mode === "create"
      ? adminBoardAssignmentUpsertSchema
      : adminBoardAssignmentUpdateSchema;

  const form = useForm({
    resolver: zodResolver(schema as never) as Resolver<CreateFormValues | EditFormValues>,
    defaultValues: defaultValues as CreateFormValues | EditFormValues,
  });

  useEffect(() => {
    if (props.open) {
      form.reset(defaultValues as CreateFormValues | EditFormValues);
      setRootMessage(null);
      setShowDeleteConfirm(defaultShowDeleteConfirm);
      setDeleteError(null);
    }
  }, [props.open, defaultValues, form, defaultShowDeleteConfirm]);

  function submit(values: CreateFormValues | EditFormValues) {
    setRootMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify(values));
      const result =
        props.mode === "create"
          ? await createBoardAssignment(undefined, fd)
          : await updateBoardAssignment(undefined, fd);
      if (!result.ok) {
        setRootMessage(result.rootError ?? "Terjadi kesalahan.");
        return;
      }
      props.onOpenChange(false);
      props.onSaved();
    });
  }

  function handleDelete() {
    if (props.mode !== "edit") return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: props.assignment.id }));
      const result = await deleteBoardAssignment(undefined, fd);
      if (!result.ok) {
        setDeleteError(result.rootError ?? "Gagal menghapus penugasan.");
        return;
      }
      props.onOpenChange(false);
      props.onSaved();
    });
  }

  const availableRoles = props.availableRoles;
  const availableMembers = props.mode === "create" ? props.availableMembers : [];

  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next) { setRootMessage(null); setDeleteError(null); setShowDeleteConfirm(false); }
        props.onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "Tambah penugasan" : "Ubah jabatan"}
          </DialogTitle>
          <DialogDescription>
            {props.mode === "create"
              ? "Pilih pengurus dan jabatan untuk periode ini."
              : `Ganti jabatan untuk ${props.assignment.managementMember.fullName}.`}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit as never)}>
          {rootMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {rootMessage}
            </p>
          ) : null}

          {props.mode === "create" ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="assign-member">Pengurus</Label>
              <Controller
                control={form.control}
                name="managementMemberId"
                render={({ field, fieldState }) => (
                  <>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                      <SelectTrigger id="assign-member">
                        <SelectValue placeholder="Pilih pengurus..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.fullName} ({m.publicCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.error ? (
                      <p className="text-xs text-destructive">{fieldState.error.message}</p>
                    ) : null}
                  </>
                )}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Label>Pengurus</Label>
              <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                {props.assignment.managementMember.fullName}{" "}
                <span className="font-mono text-muted-foreground">
                  ({props.assignment.managementMember.publicCode})
                </span>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="assign-role">Jabatan</Label>
            <Controller
              control={form.control}
              name="boardRoleId"
              render={({ field, fieldState }) => (
                <>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                    <SelectTrigger id="assign-role">
                      <SelectValue placeholder="Pilih jabatan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error ? (
                    <p className="text-xs text-destructive">{fieldState.error.message}</p>
                  ) : null}
                </>
              )}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {props.mode === "edit" && !showDeleteConfirm ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={isPending || isDeleting}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Hapus penugasan
              </Button>
            ) : null}
            {props.mode === "edit" && showDeleteConfirm ? (
              <div className="mr-auto flex flex-wrap items-center gap-2">
                <span className="text-sm text-destructive">Yakin hapus?</span>
                <Button type="button" variant="destructive" size="sm" disabled={isDeleting} onClick={handleDelete}>
                  {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Ya, hapus"}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={isDeleting} onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}>
                  Batal
                </Button>
                {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
              </div>
            ) : null}
            <Button type="button" variant="outline" disabled={isPending || isDeleting} onClick={() => props.onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending || isDeleting}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
