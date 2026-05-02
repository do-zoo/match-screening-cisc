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
  createBoardPeriod,
  deleteBoardPeriod,
  updateBoardPeriod,
} from "@/lib/actions/admin-board-periods";
import {
  adminBoardPeriodCreateSchema,
  adminBoardPeriodUpdateSchema,
} from "@/lib/forms/admin-board-period-schema";

type PeriodRow = {
  id: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
};

type FormValues = {
  id?: string;
  label: string;
  startsAt: string;
  endsAt: string;
};

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period?: PeriodRow | null;
  onSaved: () => void;
};

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ManagementPeriodFormDialog({
  mode,
  open,
  onOpenChange,
  period,
  onSaved,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const defaultValues = useMemo<FormValues>(
    () => ({
      id: period?.id,
      label: period?.label ?? "",
      startsAt: period ? toDateInputValue(period.startsAt) : "",
      endsAt: period ? toDateInputValue(period.endsAt) : "",
    }),
    [period],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(
      (mode === "create"
        ? adminBoardPeriodCreateSchema
        : adminBoardPeriodUpdateSchema) as never,
    ) as Resolver<FormValues>,
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setRootMessage(null);
      setDeleteError(null);
      setShowDeleteConfirm(false);
    }
  }, [open, defaultValues, form]);

  function submit(values: FormValues) {
    setRootMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      const payload =
        mode === "create"
          ? { label: values.label, startsAt: values.startsAt, endsAt: values.endsAt }
          : { id: period?.id ?? "", label: values.label, startsAt: values.startsAt, endsAt: values.endsAt };
      fd.set("payload", JSON.stringify(payload));
      const result =
        mode === "create"
          ? await createBoardPeriod(undefined, fd)
          : await updateBoardPeriod(undefined, fd);
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

  function handleDelete() {
    if (!period) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: period.id }));
      const result = await deleteBoardPeriod(undefined, fd);
      if (!result.ok) {
        setDeleteError(result.rootError ?? "Gagal menghapus periode.");
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
        if (!next) { setRootMessage(null); setDeleteError(null); setShowDeleteConfirm(false); }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah periode" : "Edit periode"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Buat periode kabinet baru."
              : "Perbarui data periode kabinet."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
          {rootMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {rootMessage}
            </p>
          ) : null}

          <Field label="Label periode" htmlFor="period-label" error={form.formState.errors.label?.message}>
            <Input id="period-label" disabled={isPending} {...form.register("label")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal mulai" htmlFor="period-starts-at" error={form.formState.errors.startsAt?.message}>
              <Input id="period-starts-at" type="date" disabled={isPending} {...form.register("startsAt")} />
            </Field>
            <Field label="Tanggal akhir" htmlFor="period-ends-at" error={form.formState.errors.endsAt?.message}>
              <Input id="period-ends-at" type="date" disabled={isPending} {...form.register("endsAt")} />
            </Field>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {mode === "edit" && !showDeleteConfirm ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={isPending || isDeleting}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Hapus
              </Button>
            ) : null}
            {mode === "edit" && showDeleteConfirm ? (
              <div className="mr-auto flex items-center gap-2">
                <span className="text-sm text-destructive">Yakin hapus?</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Ya, hapus"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                >
                  Batal
                </Button>
              </div>
            ) : null}
            {deleteError ? (
              <p className="text-sm text-destructive">{deleteError}</p>
            ) : null}
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
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
