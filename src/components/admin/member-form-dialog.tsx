"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  createMasterMember,
  updateMasterMember,
} from "@/lib/actions/admin-master-members";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
import {
  adminMasterMemberCreateSchema,
  adminMasterMemberUpdateSchema,
} from "@/lib/forms/admin-master-member-schema";
import type { AdminMasterMemberRowVm } from "@/lib/members/query-admin-master-members";
import { cn } from "@/lib/utils";

type MemberFormValues = {
  id?: string;
  memberNumber: string;
  fullName: string;
  whatsapp?: string;
  isActive: boolean;
};

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: AdminMasterMemberRowVm | null;
  onSaved: () => void;
};

export function MemberFormDialog({
  mode,
  open,
  onOpenChange,
  member,
  onSaved,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [rootMessage, setRootMessage] = useState<string | null>(null);

  const defaultValues = useMemo<MemberFormValues>(
    () => ({
      id: member?.id,
      memberNumber: member?.memberNumber ?? "",
      fullName: member?.fullName ?? "",
      whatsapp: member?.whatsapp ?? "",
      isActive: member?.isActive ?? true,
    }),
    [member],
  );

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(
      (mode === "create"
        ? adminMasterMemberCreateSchema
        : adminMasterMemberUpdateSchema) as never,
    ) as Resolver<MemberFormValues>,
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [defaultValues, form, open]);

  function submit(values: MemberFormValues) {
    setRootMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      const payload =
        mode === "create"
          ? {
              memberNumber: values.memberNumber,
              fullName: values.fullName,
              whatsapp: values.whatsapp ?? "",
              isActive: values.isActive,
            }
          : {
              id: member?.id ?? values.id ?? "",
              fullName: values.fullName,
              whatsapp: values.whatsapp ?? "",
              isActive: values.isActive,
            };

      fd.set("payload", JSON.stringify(payload));

      const result =
        mode === "create"
          ? await createMasterMember(undefined, fd)
          : await updateMasterMember(undefined, fd);

      if (!result.ok) {
        toastActionErr(result);
        const fieldErrors = result.fieldErrors ?? {};
        for (const [field, message] of Object.entries(fieldErrors)) {
          form.setError(field as keyof MemberFormValues, { message });
        }
        setRootMessage(
          result.rootError ??
            (Object.keys(fieldErrors).length > 0
              ? "Periksa kembali isian anggota."
              : "Terjadi kesalahan."),
        );
        return;
      }

      toastCudSuccess(
        mode === "create" ? "create" : "update",
        mode === "create"
          ? "Anggota berhasil ditambahkan."
          : "Anggota berhasil diperbarui.",
      );
      onOpenChange(false);
      onSaved();
    });
  }

  const title = mode === "create" ? "Tambah anggota" : "Edit anggota";
  const description =
    mode === "create"
      ? "Tambahkan data anggota baru ke master anggota."
      : "Perbarui data anggota di master anggota.";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setRootMessage(null);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(submit)}
        >
          {rootMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {rootMessage}
            </p>
          ) : null}

          <Field
            label="Nomor member"
            htmlFor="member-number"
            error={form.formState.errors.memberNumber?.message}
          >
            <Input
              id="member-number"
              disabled={mode === "edit" || isPending}
              aria-invalid={Boolean(form.formState.errors.memberNumber)}
              {...form.register("memberNumber")}
            />
          </Field>

          <Field
            label="Nama"
            htmlFor="member-full-name"
            error={form.formState.errors.fullName?.message}
          >
            <Input
              id="member-full-name"
              disabled={isPending}
              aria-invalid={Boolean(form.formState.errors.fullName)}
              {...form.register("fullName")}
            />
          </Field>

          <Field
            label="WhatsApp"
            htmlFor="member-whatsapp"
            error={form.formState.errors.whatsapp?.message}
          >
            <Input
              id="member-whatsapp"
              disabled={isPending}
              placeholder="6281234567890"
              aria-invalid={Boolean(form.formState.errors.whatsapp)}
              {...form.register("whatsapp")}
            />
          </Field>

          <div className="grid gap-3 rounded-lg border p-3">
            <BooleanField
              control={form.control}
              name="isActive"
              label="Aktif"
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setRootMessage(null);
                onOpenChange(false);
              }}
            >
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

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function BooleanField({
  control,
  name,
  label,
  disabled,
}: {
  control: ReturnType<typeof useForm<MemberFormValues>>["control"];
  name: "isActive";
  label: string;
  disabled: boolean;
}) {
  const id = `member-${name}`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer items-center gap-2 text-sm",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <Checkbox
            id={id}
            checked={Boolean(field.value)}
            disabled={disabled}
            onCheckedChange={(checked) => field.onChange(checked)}
          />
          <span>{label}</span>
        </label>
      )}
    />
  );
}
