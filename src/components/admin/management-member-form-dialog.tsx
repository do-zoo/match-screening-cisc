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
  createManagementMember,
  deleteManagementMember,
  updateManagementMember,
} from "@/lib/actions/admin-management-members";
import {
  adminManagementMemberCreateSchema,
  adminManagementMemberUpdateSchema,
} from "@/lib/forms/admin-management-member-schema";

type MasterMemberOption = { id: string; memberNumber: string; fullName: string };

type MemberRow = {
  id: string;
  fullName: string;
  publicCode: string;
  whatsapp: string | null;
  masterMemberId: string | null;
};

type FormValues = {
  id?: string;
  fullName: string;
  publicCode: string;
  whatsapp: string;
  masterMemberId: string;
};

const NO_LINK = "__none__";

type DialogExtras = {
  rootMessage: string | null;
  deleteError: string | null;
  showDeleteConfirm: boolean;
};

type ExtrasAction =
  | { type: "opened"; showDeleteConfirm: boolean }
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

function extrasReducer(state: DialogExtras, action: ExtrasAction): DialogExtras {
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

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: MemberRow | null;
  availableMasterMembers: MasterMemberOption[];
  onSaved: () => void;
  defaultShowDeleteConfirm?: boolean;
};

export function ManagementMemberFormDialog({
  mode,
  open,
  onOpenChange,
  member,
  availableMasterMembers,
  onSaved,
  defaultShowDeleteConfirm = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [extras, dispatchExtras] = useReducer(extrasReducer, INITIAL_EXTRAS);
  const { rootMessage, showDeleteConfirm, deleteError } = extras;
  const [isDeleting, startDeleteTransition] = useTransition();

  const defaultValues = useMemo<FormValues>(
    () => ({
      id: member?.id,
      fullName: member?.fullName ?? "",
      publicCode: member?.publicCode ?? "",
      whatsapp: member?.whatsapp ?? "",
      masterMemberId: member?.masterMemberId ?? NO_LINK,
    }),
    [member],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(
      (mode === "create"
        ? adminManagementMemberCreateSchema
        : adminManagementMemberUpdateSchema) as never,
    ) as Resolver<FormValues>,
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    dispatchExtras({
      type: "opened",
      showDeleteConfirm: defaultShowDeleteConfirm,
    });
    form.reset(defaultValues);
  }, [open, defaultValues, form, defaultShowDeleteConfirm]);

  function submit(values: FormValues) {
    if (mode === "edit" && !member) {
      dispatchExtras({
        type: "set-root-message",
        message: "Data pengurus tidak ditemukan.",
      });
      return;
    }
    dispatchExtras({ type: "set-root-message", message: null });
    startTransition(async () => {
      const fd = new FormData();
      const masterMemberId =
        values.masterMemberId === NO_LINK ? null : values.masterMemberId;
      const payload =
        mode === "create"
          ? {
              fullName: values.fullName,
              publicCode: values.publicCode,
              whatsapp: values.whatsapp,
              masterMemberId,
            }
          : {
              id: member!.id,
              fullName: values.fullName,
              publicCode: values.publicCode,
              whatsapp: values.whatsapp,
              masterMemberId,
            };
      fd.set("payload", JSON.stringify(payload));
      const result =
        mode === "create"
          ? await createManagementMember(undefined, fd)
          : await updateManagementMember(undefined, fd);
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

  function handleDelete() {
    if (!member) return;
    dispatchExtras({ type: "set-delete-error", message: null });
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: member.id }));
      const result = await deleteManagementMember(undefined, fd);
      if (!result.ok) {
        dispatchExtras({
          type: "set-delete-error",
          message: result.rootError ?? "Gagal menghapus pengurus.",
        });
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah pengurus" : "Edit pengurus"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Tambahkan pengurus baru. Kode publik otomatis diubah ke huruf kapital."
              : "Perbarui data pengurus. Kode publik otomatis diubah ke huruf kapital."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
          {rootMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {rootMessage}
            </p>
          ) : null}

          <Field label="Nama lengkap" htmlFor="mm-full-name" error={form.formState.errors.fullName?.message}>
            <Input
              id="mm-full-name"
              aria-invalid={Boolean(form.formState.errors.fullName)}
              disabled={isPending}
              {...form.register("fullName")}
            />
          </Field>

          <Field label="Kode publik" htmlFor="mm-public-code" error={form.formState.errors.publicCode?.message}>
            <Input
              id="mm-public-code"
              aria-invalid={Boolean(form.formState.errors.publicCode)}
              disabled={isPending}
              className="font-mono uppercase"
              placeholder="cth: AF2025"
              {...form.register("publicCode")}
            />
          </Field>

          <Field label="WhatsApp (opsional)" htmlFor="mm-whatsapp" error={form.formState.errors.whatsapp?.message}>
            <Input
              id="mm-whatsapp"
              aria-invalid={Boolean(form.formState.errors.whatsapp)}
              disabled={isPending}
              placeholder="6281234567890"
              {...form.register("whatsapp")}
            />
          </Field>

          <Field label="Tautan anggota (opsional)" htmlFor="mm-master-member" error={form.formState.errors.masterMemberId?.message}>
            <Controller
              control={form.control}
              name="masterMemberId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_LINK}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger id="mm-master-member">
                    <SelectValue placeholder="Tidak ditautkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LINK}>Tidak ditautkan</SelectItem>
                    {availableMasterMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.memberNumber} — {m.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <DialogFooter className="gap-2 sm:gap-0">
            {mode === "edit" && !showDeleteConfirm ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={isPending || isDeleting}
                onClick={() => dispatchExtras({ type: "show-delete-prompt" })}
              >
                Hapus
              </Button>
            ) : null}
            {mode === "edit" && showDeleteConfirm ? (
              <div className="mr-auto flex flex-wrap items-center gap-2">
                <span className="text-sm text-destructive">Yakin hapus?</span>
                <Button type="button" variant="destructive" size="sm" disabled={isDeleting} onClick={handleDelete}>
                  {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Ya, hapus"}
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
                {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
              </div>
            ) : null}
            <Button type="button" variant="outline" disabled={isPending || isDeleting} onClick={() => onOpenChange(false)}>
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
