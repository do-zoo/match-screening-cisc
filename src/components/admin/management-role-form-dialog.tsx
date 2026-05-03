"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
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
  createBoardRole,
  deactivateBoardRole,
  updateBoardRole,
} from "@/lib/actions/admin-board-roles";
import {
  adminBoardRoleCreateSchema,
  adminBoardRoleUpdateSchema,
} from "@/lib/forms/admin-board-role-schema";

type RoleRow = {
  id: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
};

type FormValues = {
  id?: string;
  title: string;
  sortOrder: string;
};

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRow | null;
  onSaved: () => void;
  defaultShowDeactivateConfirm?: boolean;
};

export function ManagementRoleFormDialog({
  mode,
  open,
  onOpenChange,
  role,
  onSaved,
  defaultShowDeactivateConfirm = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isDeactivating, startDeactivateTransition] = useTransition();

  const defaultValues = useMemo<FormValues>(
    () => ({
      id: role?.id,
      title: role?.title ?? "",
      sortOrder: String(role?.sortOrder ?? 0),
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
    if (open) {
      form.reset(defaultValues);
      setRootMessage(null);
      setDeactivateError(null);
      setShowDeactivateConfirm(defaultShowDeactivateConfirm);
    }
  }, [open, defaultValues, form, defaultShowDeactivateConfirm]);

  function submit(values: FormValues) {
    if (mode === "edit" && !role) {
      setRootMessage("Data jabatan tidak ditemukan.");
      return;
    }
    setRootMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      const payload =
        mode === "create"
          ? { title: values.title, sortOrder: Number(values.sortOrder) }
          : { id: role!.id, title: values.title, sortOrder: Number(values.sortOrder) };
      fd.set("payload", JSON.stringify(payload));
      const result =
        mode === "create"
          ? await createBoardRole(undefined, fd)
          : await updateBoardRole(undefined, fd);
      if (!result.ok) {
        for (const [f, m] of Object.entries(result.fieldErrors ?? {}))
          form.setError(f as keyof FormValues, { message: m });
        setRootMessage(result.rootError ?? "Terjadi kesalahan.");
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  function handleDeactivate() {
    if (!role) return;
    setDeactivateError(null);
    startDeactivateTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: role.id }));
      const result = await deactivateBoardRole(undefined, fd);
      if (!result.ok) {
        setDeactivateError(result.rootError ?? "Gagal menonaktifkan jabatan.");
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
        if (!next) { setRootMessage(null); setDeactivateError(null); setShowDeactivateConfirm(false); }
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

          <DialogFooter className="gap-2 sm:gap-0">
            {canDeactivate && !showDeactivateConfirm ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={isPending || isDeactivating}
                onClick={() => setShowDeactivateConfirm(true)}
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
                <Button type="button" variant="outline" size="sm" disabled={isDeactivating} onClick={() => { setShowDeactivateConfirm(false); setDeactivateError(null); }}>
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
