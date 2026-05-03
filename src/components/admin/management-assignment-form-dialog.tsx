"use client";

import { useEffect, useMemo, useReducer, useTransition } from "react";
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

type DialogExtras = {
  rootMessage: string | null;
  deleteError: string | null;
  showDeleteConfirm: boolean;
};

type ExtrasAction =
  | {
      type: "opened";
      showDeleteConfirm: boolean;
    }
  | { type: "closed" }
  | { type: "set-root-message"; message: string | null }
  | { type: "set-delete-error"; message: string | null }
  | { type: "show-delete-prompt" }
  | { type: "cancel-delete-prompt" };

const INITIAL_EXTRAS: DialogExtras = {
  rootMessage: null,
  deleteError: null,
  showDeleteConfirm: false,
};

function extrasReducer(
  state: DialogExtras,
  action: ExtrasAction,
): DialogExtras {
  switch (action.type) {
    case "opened":
      return {
        rootMessage: null,
        deleteError: null,
        showDeleteConfirm: action.showDeleteConfirm,
      };
    case "closed":
      return INITIAL_EXTRAS;
    case "set-root-message":
      return { ...state, rootMessage: action.message };
    case "set-delete-error":
      return { ...state, deleteError: action.message };
    case "show-delete-prompt":
      return { ...state, showDeleteConfirm: true };
    case "cancel-delete-prompt":
      return { ...state, showDeleteConfirm: false, deleteError: null };
    default:
      return state;
  }
}

export function ManagementAssignmentFormDialog(props: Props) {
  const [isPending, startTransition] = useTransition();
  const [extras, dispatchExtras] = useReducer(extrasReducer, INITIAL_EXTRAS);
  const { rootMessage, showDeleteConfirm, deleteError } = extras;
  const [isDeleting, startDeleteTransition] = useTransition();

  const defaultShowDeleteConfirm =
    props.mode === "edit" ? (props.defaultShowDeleteConfirm ?? false) : false;

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
    resolver: zodResolver(schema as never) as Resolver<
      CreateFormValues | EditFormValues
    >,
    defaultValues: defaultValues as CreateFormValues | EditFormValues,
  });

  useEffect(() => {
    if (!props.open) return;
    dispatchExtras({
      type: "opened",
      showDeleteConfirm: defaultShowDeleteConfirm,
    });
    form.reset(defaultValues as CreateFormValues | EditFormValues);
  }, [props.open, defaultValues, form, defaultShowDeleteConfirm]);

  function submit(values: CreateFormValues | EditFormValues) {
    dispatchExtras({ type: "set-root-message", message: null });
    startTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify(values));
      const result =
        props.mode === "create"
          ? await createBoardAssignment(undefined, fd)
          : await updateBoardAssignment(undefined, fd);
      if (!result.ok) {
        dispatchExtras({
          type: "set-root-message",
          message: result.rootError ?? "Terjadi kesalahan.",
        });
        return;
      }
      props.onOpenChange(false);
      props.onSaved();
    });
  }

  function handleDelete() {
    if (props.mode !== "edit") return;
    dispatchExtras({ type: "set-delete-error", message: null });
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: props.assignment.id }));
      const result = await deleteBoardAssignment(undefined, fd);
      if (!result.ok) {
        dispatchExtras({
          type: "set-delete-error",
          message: result.rootError ?? "Gagal menghapus penugasan.",
        });
        return;
      }
      props.onOpenChange(false);
      props.onSaved();
    });
  }

  const availableRoles = props.availableRoles;
  const availableMembers =
    props.mode === "create" ? props.availableMembers : [];

  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next) {
          dispatchExtras({ type: "closed" });
        }
        props.onOpenChange(next);
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-lg sm:rounded-2xl">
        <DialogHeader className="space-y-2 border-b border-border/80 px-6 pt-6 pb-5 text-left sm:pr-14">
          <DialogTitle className="text-lg leading-tight font-semibold tracking-tight sm:text-xl">
            {props.mode === "create" ? "Tambah penugasan" : "Ubah jabatan"}
          </DialogTitle>
          <DialogDescription className="text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
            {props.mode === "create"
              ? "Pilih pengurus dan jabatan untuk periode ini."
              : `Ganti jabatan untuk ${props.assignment.managementMember.fullName}.`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col"
          onSubmit={form.handleSubmit(submit as never)}
        >
          <div className="flex flex-col gap-6 px-6 py-6">
            {rootMessage ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/35 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
              >
                {rootMessage}
              </p>
            ) : null}

            <div className="flex flex-col gap-6">
              {props.mode === "create" ? (
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <Label
                      htmlFor="assign-member"
                      className="text-sm font-medium text-foreground"
                    >
                      Pengurus
                    </Label>
                  </div>
                  <Controller
                    control={form.control}
                    name="managementMemberId"
                    render={({ field, fieldState }) => (
                      <div className="space-y-1.5">
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isPending}
                        >
                          <SelectTrigger
                            id="assign-member"
                            size="default"
                            className="h-11 w-full min-w-0 px-3 shadow-sm transition-colors hover:bg-muted/40"
                          >
                            <SelectValue placeholder="Pilih pengurus…" />
                          </SelectTrigger>
                          <SelectContent
                            className="min-w-(--anchor-width) max-w-[calc(100vw-2rem)]"
                            align="start"
                          >
                            {availableMembers.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                <span className="font-medium">
                                  {m.fullName}
                                </span>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {" "}
                                  ({m.publicCode})
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.error ? (
                          <p className="text-xs text-destructive">
                            {fieldState.error.message}
                          </p>
                        ) : null}
                      </div>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <Label className="text-sm font-medium text-foreground">
                    Pengurus
                  </Label>
                  <div className="rounded-xl border border-border/80 bg-muted/35 px-4 py-3.5 text-sm shadow-inner">
                    <p className="font-medium leading-snug">
                      {props.assignment.managementMember.fullName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {props.assignment.managementMember.publicCode}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="space-y-1">
                  <Label
                    htmlFor="assign-role"
                    className="text-sm font-medium text-foreground"
                  >
                    Jabatan
                  </Label>
                </div>
                <Controller
                  control={form.control}
                  name="boardRoleId"
                  render={({ field, fieldState }) => (
                    <div className="space-y-1.5">
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isPending}
                      >
                        <SelectTrigger
                          id="assign-role"
                          size="default"
                          className="h-11 w-full min-w-0 px-3 shadow-sm transition-colors hover:bg-muted/40"
                        >
                          <SelectValue placeholder="Pilih jabatan…" />
                        </SelectTrigger>
                        <SelectContent
                          className="min-w-(--anchor-width) max-w-[calc(100vw-2rem)]"
                          align="start"
                        >
                          {availableRoles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.error ? (
                        <p className="text-xs text-destructive">
                          {fieldState.error.message}
                        </p>
                      ) : null}
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 flex-col-reverse gap-3 rounded-b-2xl border-t border-border/80 bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end [&>button:last-of-type]:min-w-25">
            {props.mode === "edit" && !showDeleteConfirm ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={isPending || isDeleting}
                onClick={() => dispatchExtras({ type: "show-delete-prompt" })}
              >
                Hapus penugasan
              </Button>
            ) : null}
            {props.mode === "edit" && showDeleteConfirm ? (
              <div className="mr-auto flex flex-wrap items-center gap-2">
                <span className="text-sm text-destructive">Yakin hapus?</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Ya, hapus"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() =>
                    dispatchExtras({ type: "cancel-delete-prompt" })
                  }
                >
                  Batal
                </Button>
                {deleteError ? (
                  <p className="text-sm text-destructive">{deleteError}</p>
                ) : null}
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={isPending || isDeleting}
              onClick={() => props.onOpenChange(false)}
            >
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
