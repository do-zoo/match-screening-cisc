"use client";

import * as React from "react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";

import { createAdminEvent, updateAdminEvent } from "@/lib/actions/admin-events";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
import {
  adminEventUpsertSchema,
  type AdminEventUpsertInput,
} from "@/lib/forms/admin-event-form-schema";
import { findLockedViolations } from "@/lib/events/event-edit-guards";
import type { EventIntegritySnapshot } from "@/lib/events/event-edit-guards";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/datetime-picker";

const SENSITIVE_ACK_MESSAGE =
  "Centang pengakuan untuk mengubah harga tiket/voucher, PIC utama, atau rekening pembayaran.";

export type EventAdminPicOption = { id: string; label: string };

export type EventAdminFormProps = {
  mode: "create" | "edit";
  eventId?: string;
  committeeDefaults?: {
    ticketMemberPrice: number;
    ticketNonMemberPrice: number;
  };
  defaults: AdminEventUpsertInput;
  registrationCount?: number;
  persistedIntegrity?: EventIntegritySnapshot | null;
  /** Admin profiles eligible as event PIC (financial owner). */
  picOptions: EventAdminPicOption[];
  banksByPic: Record<string, Array<{ id: string; label: string }>>;
  /** Admin profiles eligible as PIC pembantu (same pool as PIC; PIC excluded in form). */
  helperAdminOptions: EventAdminPicOption[];
};

export function EventAdminForm(props: EventAdminFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [pendingAcknowledge, setPendingAcknowledge] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const registrationCount = props.registrationCount ?? 0;
  const persistedIntegrity =
    props.persistedIntegrity ??
    ({
      slug: "",
      menuMode: props.defaults.menuMode,
      menuSelection: props.defaults.menuSelection,
      ticketMemberPrice: props.defaults.ticketMemberPrice,
      ticketNonMemberPrice: props.defaults.ticketNonMemberPrice,
      voucherPrice: props.defaults.voucherPriceIdr,
      pricingSource: props.defaults.pricingSource,
      picAdminProfileId: props.defaults.picAdminProfileId,
      bankAccountId: props.defaults.bankAccountId,
    } satisfies EventIntegritySnapshot);

  const form = useForm<AdminEventUpsertInput>({
    resolver: zodResolver(
      adminEventUpsertSchema as never,
    ) as Resolver<AdminEventUpsertInput>,
    defaultValues: props.defaults,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "menuItems",
  });

  const menuMode = useWatch({ control: form.control, name: "menuMode" });
  const menuSelection = useWatch({
    control: form.control,
    name: "menuSelection",
  });
  const pricingSource = useWatch({
    control: form.control,
    name: "pricingSource",
  });
  const picId = useWatch({ control: form.control, name: "picAdminProfileId" });
  const bankAccountId = useWatch({
    control: form.control,
    name: "bankAccountId",
  });
  const committee = props.committeeDefaults;
  const helpersSelected =
    useWatch({
      control: form.control,
      name: "helperAdminProfileIds",
    }) ?? [];

  const bankChoices = useMemo(() => {
    return props.banksByPic[picId] ?? [];
  }, [props.banksByPic, picId]);

  const lockedMenuKeys = useMemo(() => {
    return findLockedViolations({
      registrationCount,
      persisted: persistedIntegrity,
      candidate: {
        menuMode,
        menuSelection,
      },
    });
  }, [registrationCount, persistedIntegrity, menuMode, menuSelection]);

  const pickCommitteePrices = useCallback(() => {
    if (!committee) return;
    form.setValue("ticketMemberPrice", committee.ticketMemberPrice, {
      shouldDirty: true,
    });
    form.setValue("ticketNonMemberPrice", committee.ticketNonMemberPrice, {
      shouldDirty: true,
    });
  }, [committee, form]);

  useEffect(() => {
    if (
      props.mode === "create" &&
      committee &&
      form.getValues("pricingSource") === "global_default"
    ) {
      pickCommitteePrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed committee prices once on mount for new events
  }, []);

  useEffect(() => {
    if (menuMode === "PRESELECT") {
      form.setValue("voucherPriceIdr", null, { shouldDirty: true });
    }
  }, [form, menuMode]);

  const submitPayload = useCallback(
    (withAck: boolean) => {
      setRootMessage(null);
      startTransition(async () => {
        const fd = new FormData();
        const payload: AdminEventUpsertInput = {
          ...form.getValues(),
          acknowledgeSensitiveChanges: withAck,
        };
        fd.set("payload", JSON.stringify(payload));
        if (coverFile && coverFile.size > 0) {
          fd.set("cover", coverFile);
        }

        const result =
          props.mode === "create"
            ? await createAdminEvent(undefined, fd)
            : await updateAdminEvent(props.eventId ?? "", undefined, fd);

        if (
          props.mode === "edit" &&
          !result.ok &&
          result.rootError === SENSITIVE_ACK_MESSAGE &&
          !withAck
        ) {
          setPendingAcknowledge(true);
          return;
        }

        if (!result.ok) {
          toastActionErr(result);
          if (result.rootError) setRootMessage(result.rootError);
          else if (result.fieldErrors && Object.keys(result.fieldErrors).length)
            setRootMessage(Object.values(result.fieldErrors).join(" "));
          return;
        }

        if (props.mode === "create") {
          toastCudSuccess("create", "Acara berhasil dibuat.");
          router.push(`/admin/events/${result.data.eventId}/edit`);
        } else {
          toastCudSuccess("update", "Acara berhasil diperbarui.");
          router.refresh();
        }
      });
    },
    [coverFile, form, props.eventId, props.mode, router],
  );

  return (
    <>
      <form
        className="space-y-10"
        onSubmit={form.handleSubmit(() => submitPayload(false))}
      >
        {rootMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Gagal menyimpan</AlertTitle>
            <AlertDescription>{rootMessage}</AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Dasar acara</h2>
          <Field label="Judul">
            <Input {...form.register("title")} disabled={pending} />
          </Field>
          <Field label="Ringkasan">
            <Textarea
              {...form.register("summary")}
              disabled={pending}
              className="resize-y"
            />
          </Field>
          <Field label="Deskripsi">
            <Controller
              control={form.control}
              name="descriptionHtml"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                />
              )}
            />
          </Field>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-lg font-medium sm:col-span-2">Jadwal & lokasi</h2>
          <Field label="Waktu mulai">
            <Controller
              control={form.control}
              name="startAtIso"
              render={({ field, fieldState }) => (
                <DateTimePicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                  aria-invalid={fieldState.invalid}
                />
              )}
            />
          </Field>
          <Field label="Waktu selesai">
            <Controller
              control={form.control}
              name="endAtIso"
              render={({ field, fieldState }) => (
                <DateTimePicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                  aria-invalid={fieldState.invalid}
                />
              )}
            />
          </Field>
          <Field label="Nama venue">
            <Input {...form.register("venueName")} disabled={pending} />
          </Field>
          <Field label="Alamat venue">
            <Input {...form.register("venueAddress")} disabled={pending} />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Registrasi</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status acara">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (v != null) field.onChange(v);
                    }}
                    disabled={pending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draf</SelectItem>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="finished">Selesai</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Kapasitas (kosongkan = tak terbatas)">
              <Controller
                control={form.control}
                name="registrationCapacity"
                render={({ field }) => (
                  <Input
                    type="number"
                    min={0}
                    disabled={pending}
                    placeholder="Opsional"
                    value={
                      field.value === null || field.value === undefined
                        ? ""
                        : field.value
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") field.onChange(null);
                      else field.onChange(Number.parseInt(raw, 10));
                    }}
                  />
                )}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...form.register("registrationManualClosed")}
              disabled={pending}
            />
            Tutup registrasi secara manual (formulir diblokir)
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Harga tiket</h2>
          <Field label="Sumber harga">
            <Select
              value={pricingSource}
              onValueChange={(v) => {
                if (v == null) return;
                const next = v as AdminEventUpsertInput["pricingSource"];
                form.setValue("pricingSource", next, { shouldDirty: true });
                if (next === "global_default") pickCommitteePrices();
              }}
              disabled={pending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global_default">Default komite</SelectItem>
                <SelectItem value="overridden">Override per acara</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tiket member (IDR)">
              <Input
                type="number"
                min={0}
                disabled={pending || pricingSource === "global_default"}
                {...form.register("ticketMemberPrice", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Tiket non-member (IDR)">
              <Input
                type="number"
                min={0}
                disabled={pending || pricingSource === "global_default"}
                {...form.register("ticketNonMemberPrice", {
                  valueAsNumber: true,
                })}
              />
            </Field>
          </div>
          <p className="text-muted-foreground text-xs">
            Jika memilih default komite, nilai disimpan dari{" "}
            <strong>Pengaturan → Harga default</strong> (basis data bila sudah
            pernah disimpan), lalu env <code>MATCH_DEFAULT_TICKET_*_IDR</code>,
            lalu fallback bawaan aplikasi.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Konfigurasi menu</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mode menu">
              <Select
                value={menuMode}
                onValueChange={(v) => {
                  if (v == null) return;
                  form.setValue(
                    "menuMode",
                    v as AdminEventUpsertInput["menuMode"],
                    {
                      shouldDirty: true,
                    },
                  );
                }}
                disabled={pending || lockedMenuKeys.includes("menuMode")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESELECT">Pilih menu di form</SelectItem>
                  <SelectItem value="VOUCHER">Voucher</SelectItem>
                </SelectContent>
              </Select>
              {lockedMenuKeys.includes("menuMode") ? (
                <Muted>Terhubung pada pendaftar — tidak dapat diubah.</Muted>
              ) : null}
            </Field>
            <Field label="Pilihan menu">
              <Select
                value={menuSelection}
                onValueChange={(v) => {
                  if (v == null) return;
                  form.setValue(
                    "menuSelection",
                    v as AdminEventUpsertInput["menuSelection"],
                    { shouldDirty: true },
                  );
                }}
                disabled={pending || lockedMenuKeys.includes("menuSelection")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE">Satu opsi per tiket</SelectItem>
                  <SelectItem value="MULTI">Multi pilih per tiket</SelectItem>
                </SelectContent>
              </Select>
              {lockedMenuKeys.includes("menuSelection") ? (
                <Muted>Terhubung pada pendaftar — tidak dapat diubah.</Muted>
              ) : null}
            </Field>
          </div>

          <Field label="Harga voucher (IDR)">
            <Input
              type="number"
              min={0}
              disabled={pending || menuMode !== "VOUCHER"}
              placeholder={
                menuMode === "VOUCHER" ? "Wajib" : "Hanya mode Voucher"
              }
              {...form.register("voucherPriceIdr", {
                setValueAs: (v) =>
                  v === "" || v === undefined || Number.isNaN(Number(v))
                    ? null
                    : Number(v),
              })}
            />
          </Field>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-medium">Item menu</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                append({
                  name: "Item baru",
                  priceIdr: 0,
                  sortOrder: fields.length + 1,
                  voucherEligible: true,
                })
              }
            >
              Tambah item
            </Button>
          </div>
          <div className="space-y-3">
            {fields.map((row, index) => (
              <div
                key={row.id}
                className="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-3"
              >
                <Field label="Nama" className="min-w-[10rem] flex-1">
                  <Input
                    {...form.register(`menuItems.${index}.name`)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Harga (IDR)" className="w-32">
                  <Input
                    type="number"
                    min={0}
                    disabled={pending}
                    {...form.register(`menuItems.${index}.priceIdr`, {
                      valueAsNumber: true,
                    })}
                  />
                </Field>
                <Field label="Urutan" className="w-24">
                  <Input
                    type="number"
                    min={0}
                    disabled={pending}
                    {...form.register(`menuItems.${index}.sortOrder`, {
                      valueAsNumber: true,
                    })}
                  />
                </Field>
                <label className="flex items-center gap-2 pb-2 text-xs">
                  <input
                    type="checkbox"
                    {...form.register(`menuItems.${index}.voucherEligible`)}
                    disabled={pending}
                  />
                  Voucher eligible
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || fields.length <= 1}
                  onClick={() => remove(index)}
                >
                  Hapus
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">PIC & rekening</h2>
          <Field label="PIC utama">
            <Select
              value={picId}
              onValueChange={(next) => {
                if (next == null) return;
                form.setValue("picAdminProfileId", next, { shouldDirty: true });
                const first = props.banksByPic[next]?.[0]?.id ?? "";
                form.setValue("bankAccountId", first, { shouldDirty: true });
              }}
              disabled={pending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {props.picOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rekening pembayaran">
            <Select
              value={bankAccountId}
              onValueChange={(v) => {
                if (v == null) return;
                form.setValue("bankAccountId", v, { shouldDirty: true });
              }}
              disabled={pending || bankChoices.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bankChoices.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bankChoices.length === 0 ? (
              <Muted>
                Tidak ada rekening aktif untuk PIC ini — tambahkan di pengaturan
                komite.
              </Muted>
            ) : null}
          </Field>

          <Field label={`PIC pembantu (${helpersSelected.length})`}>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-3">
              {props.helperAdminOptions.map((p) => {
                const currentHelpers: string[] =
                  form.getValues("helperAdminProfileIds") ?? [];
                const checked = currentHelpers.includes(p.id);
                const disabledAsPic = p.id === picId;
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      checked && "border-primary/40 bg-primary/5",
                      disabledAsPic && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={checked}
                      disabled={disabledAsPic || pending}
                      onChange={(e) => {
                        const prev: string[] =
                          form.getValues("helperAdminProfileIds") ?? [];
                        if (e.target.checked) {
                          form.setValue(
                            "helperAdminProfileIds",
                            [...prev, p.id],
                            {
                              shouldDirty: true,
                            },
                          );
                        } else {
                          form.setValue(
                            "helperAdminProfileIds",
                            prev.filter((id) => id !== p.id),
                            { shouldDirty: true },
                          );
                        }
                      }}
                    />
                    {p.label}
                  </label>
                );
              })}
            </div>
          </Field>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Sampul</h2>
          <p className="text-muted-foreground text-sm">
            {props.mode === "create"
              ? "Unggah gambar sampul — wajib untuk acara baru."
              : "Unggah gambar baru bila ingin mengganti sampul (opsional)."}
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            disabled={pending}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-xs"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          />
        </section>

        <div className="flex flex-wrap gap-3 pb-16">
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
          <Link
            href="/admin/events"
            className={buttonVariants({ variant: "outline" })}
          >
            Batal
          </Link>
        </div>
      </form>

      <Dialog open={pendingAcknowledge} onOpenChange={setPendingAcknowledge}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi perubahan sensitif</DialogTitle>
            <DialogDescription>
              Anda mengubah harga tiket/voucher, sumber harga, PIC utama, atau
              rekening. Pastikan ini disengaja sebelum melanjutkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingAcknowledge(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPendingAcknowledge(false);
                submitPayload(true);
              }}
            >
              Lanjutkan dan simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>;
}
