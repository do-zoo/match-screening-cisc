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
  createBoardRole,
  deactivateBoardRole,
  updateBoardRole,
} from "@/lib/actions/admin-board-roles";
import {
  adminBoardRoleCreateSchema,
  adminBoardRoleUpdateSchema,
} from "@/lib/forms/admin-board-role-schema";

const ROLE_PARENT_NONE = "__none__";

type RoleRow = {
  id: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  isUnique: boolean;
  parentRoleId: string | null;
};

type RoleOption = { id: string; title: string };

type FormValues = {
  id?: string;
  title: string;
  sortOrder: string;
  isUnique: boolean;
  parentRoleId: string;
};

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRow | null;
  /** All active roles — used for parent selector. */
  allRoles: RoleOption[];
  onSaved: () => void;
  defaultShowDeactivateConfirm?: boolean;
};

type DialogExtras = {
  rootMessage: string | null;
  deactivateError: string | null;
  showDeactivateConfirm: boolean;
};

type ExtrasAction =
  | { type: "opened"; showDeactivateConfirm: boolean }
  | { type: "closed" }
  | { type: "set-root-message"; message: string | null }
  | { type: "set-deactivate-error"; message: string | null }
  | { type: "show-deactivate-prompt" }
  | { type: "cancel-deactivate-prompt" };

const INITIAL_EXTRAS: DialogExtras = {
  rootMessage: null,
  deactivateError: null,
  showDeactivateConfirm: false,
};

function extrasReducer(state: DialogExtras, action: ExtrasAction): DialogExtras {
  switch (action.type) {
    case "opened":
      return {
        rootMessage: null,
        deactivateError: null,
        showDeactivateConfirm: action.showDeactivateConfirm,
      };
    case "closed":
      return INITIAL_EXTRAS;
    case "set-root-message":
      return { ...state, rootMessage: action.message };
    case "set-deactivate-error":
      return { ...state, deactivateError: action.message };
    case "show-deactivate-prompt":
      return { ...state, showDeactivateConfirm: true };
    case "cancel-deactivate-prompt":
      return { ...state, showDeactivateConfirm: false, deactivateError: null };
    default:
      return state;
  }
}

export function ManagementRoleFormDialog({
  mode,
  open,
  onOpenChange,
  role,
  allRoles,
  onSaved,
  defaultShowDeactivateConfirm = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [extras, dispatchExtras] = useReducer(extrasReducer, INITIAL_EXTRAS);
  const { rootMessage, deactivateError, showDeactivateConfirm } = extras;
  const [isDeactivating, startDeactivateTransition] = useTransition();

  const defaultValues = useMemo<FormValues>(
    () => ({
      id: role?.id,
      title: role?.title ?? "",
      sortOrder: String(role?.sortOrder ?? 0),
      isUnique: role?.isUnique ?? true,
      parentRoleId: role?.parentRoleId ?? ROLE_PARENT_NONE,
    }),
    [role],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(
      (mode === "create"
        ? adminBoardRoleCreateSchema
        : adminBoardRoleUpdateSchema) as never,
    ) as Resolver<FormValues>,
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    dispatchExtras({
      type: "opened",
      showDeactivateConfirm: defaultShowDeactivateConfirm,
    });
    form.reset(defaultValues);
  }, [open, defaultValues, form, defaultShowDeactivateConfirm]);

  function submit(values: FormValues) {
    if (mode === "edit" && !role) {
      dispatchExtras({
        type: "set-root-message",
        message: "Data jabatan tidak ditemukan.",
      });
      return;
    }
    dispatchExtras({ type: "set-root-message", message: null });
    startTransition(async () => {
      const fd = new FormData();
      const parentNorm =
        values.parentRoleId === ROLE_PARENT_NONE
          ? null
          : values.parentRoleId.trim() || null;
      const payload =
        mode === "create"
          ? {
              title: values.title,
              sortOrder: Number(values.sortOrder),
              isUnique: values.isUnique,
              parentRoleId: parentNorm,
            }
          : {
              id: role!.id,
              title: values.title,
              sortOrder: Number(values.sortOrder),
              isUnique: values.isUnique,
              parentRoleId: parentNorm,
            };
      fd.set("payload", JSON.stringify(payload));
      const result =
        mode === "create"
          ? await createBoardRole(undefined, fd)
          : await updateBoardRole(undefined, fd);
      if (!result.ok) {
        for (const [f, m] of Object.entries(result.fieldErrors ?? {}))
          form.setError(f as keyof FormValues, { message: m });
        dispatchExtras({
          type: "set-root-message",
          message: result.rootError ?? "Terjadi kesalahan.",
        });
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  function handleDeactivate() {
    if (!role) return;
    dispatchExtras({ type: "set-deactivate-error", message: null });
    startDeactivateTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: role.id }));
      const result = await deactivateBoardRole(undefined, fd);
      if (!result.ok) {
        dispatchExtras({
          type: "set-deactivate-error",
          message: result.rootError ?? "Gagal menonaktifkan jabatan.",
        });
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  const canDeactivate = mode === "edit" && role?.isActive;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          dispatchExtras({ type: "closed" });
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah jabatan" : "Edit jabatan"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Tambahkan jabatan baru ke daftar BoardRole."
              : "Perbarui nama dan urutan jabatan."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
          {rootMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {rootMessage}
            </p>
          ) : null}

          <Field label="Nama jabatan" htmlFor="role-title" error={form.formState.errors.title?.message}>
            <Input
              id="role-title"
              aria-invalid={Boolean(form.formState.errors.title)}
              disabled={isPending}
              {...form.register("title")}
            />
          </Field>

          <Field label="Urutan tampil" htmlFor="role-sort-order" error={form.formState.errors.sortOrder?.message}>
            <Input
              id="role-sort-order"
              type="number"
              aria-invalid={Boolean(form.formState.errors.sortOrder)}
              disabled={isPending}
              {...form.register("sortOrder")}
            />
          </Field>

          <Field label="Jabatan induk" htmlFor="role-parent">
            <Controller
              control={form.control}
              name="parentRoleId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger id="role-parent" size="default" className="h-10 w-full">
                    <SelectValue placeholder="— Tidak ada induk —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROLE_PARENT_NONE}>— Tidak ada induk —</SelectItem>
                    {allRoles
                      .filter((r) => r.id !== role?.id)
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Kapasitas" htmlFor="role-unique">
            <Controller
              control={form.control}
              name="isUnique"
              render={({ field }) => (
                <Select
                  value={field.value ? "1" : "many"}
                  onValueChange={(v) => field.onChange(v === "1")}
                  disabled={isPending}
                >
                  <SelectTrigger id="role-unique" size="default" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Hanya 1 orang per periode</SelectItem>
                    <SelectItem value="many">Boleh banyak orang</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <DialogFooter className="gap-2 sm:gap-0">
            {canDeactivate && !showDeactivateConfirm ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={isPending || isDeactivating}
                onClick={() =>
                  dispatchExtras({ type: "show-deactivate-prompt" })
                }
              >
                Nonaktifkan
              </Button>
            ) : null}
            {canDeactivate && showDeactivateConfirm ? (
              <div className="mr-auto flex flex-wrap items-center gap-2">
                <span className="text-sm text-destructive">Yakin nonaktifkan?</span>
                <Button type="button" variant="destructive" size="sm" disabled={isDeactivating} onClick={handleDeactivate}>
                  {isDeactivating ? <Loader2 className="size-4 animate-spin" /> : "Ya"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDeactivating}
                  onClick={() =>
                    dispatchExtras({ type: "cancel-deactivate-prompt" })
                  }
                >
                  Batal
                </Button>
                {deactivateError ? <p className="text-sm text-destructive">{deactivateError}</p> : null}
              </div>
            ) : null}
            <Button type="button" variant="outline" disabled={isPending || isDeactivating} onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending || isDeactivating}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, error, children }: {
  label: string; htmlFor: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
