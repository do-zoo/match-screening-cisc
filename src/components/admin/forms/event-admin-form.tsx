"use client";

import * as React from "react";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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

import {
  createAdminEvent,
  updateAdminEvent,
} from "@/lib/actions/admin-events";
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

const SENSITIVE_ACK_MESSAGE =
  "Centang pengakuan untuk mengubah harga tiket/voucher, PIC utama, atau rekening pembayaran.";

export type EventAdminPicOption = { id: string; label: string };

export type EventAdminFormProps = {
  mode: "create" | "edit";
  eventId?: string;
  committeeDefaults?: { ticketMemberPrice: number; ticketNonMemberPrice: number };
  defaults: AdminEventUpsertInput;
  registrationCount?: number;
  persistedIntegrity?: EventIntegritySnapshot | null;
  picOptions: EventAdminPicOption[];
  banksByPic: Record<string, Array<{ id: string; label: string }>>;
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
      picMasterMemberId: props.defaults.picMasterMemberId,
      bankAccountId: props.defaults.bankAccountId,
    } satisfies EventIntegritySnapshot);

  const form = useForm<AdminEventUpsertInput>({
    resolver: zodResolver(adminEventUpsertSchema as never) as Resolver<AdminEventUpsertInput>,
    defaultValues: props.defaults,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "menuItems",
  });

  const menuMode = useWatch({ control: form.control, name: "menuMode" });
  const menuSelection = useWatch({ control: form.control, name: "menuSelection" });
  const pricingSource = useWatch({ control: form.control, name: "pricingSource" });
  const picId = useWatch({ control: form.control, name: "picMasterMemberId" });
  const bankAccountId = useWatch({ control: form.control, name: "bankAccountId" });
  const committee = props.committeeDefaults;
  const helpersSelected = useWatch({
    control: form.control,
    name: "helperMasterMemberIds",
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
    if (props.mode === "create" && committee && form.getValues("pricingSource") === "global_default") {
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
          if (result.rootError) setRootMessage(result.rootError);
          else if (result.fieldErrors && Object.keys(result.fieldErrors).length)
            setRootMessage(Object.values(result.fieldErrors).join(" "));
          return;
        }

        if (props.mode === "create") {
          router.push(`/admin/events/${result.data.eventId}/edit`);
        } else {
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Judul">
              <Input {...form.register("title")} disabled={pending} />
            </Field>
            <Field label="Ringkasan">
              <Input {...form.register("summary")} disabled={pending} />
            </Field>
          </div>
          <Field label="Deskripsi (HTML)">
            <textarea
              {...form.register("descriptionHtml")}
              rows={8}
              disabled={pending}
              className={cn(
                "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]",
              )}
            />
          </Field>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-lg font-medium sm:col-span-2">Jadwal & lokasi</h2>
          <Field label="Mulai (ISO)">
            <Input {...form.register("startAtIso")} disabled={pending} />
          </Field>
          <Field label="Selesai (ISO)">
            <Input {...form.register("endAtIso")} disabled={pending} />
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
              <select
                {...form.register("status")}
                disabled={pending}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="draft">Draf</option>
                <option value="active">Aktif</option>
                <option value="finished">Selesai</option>
              </select>
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
                    value={field.value === null || field.value === undefined ? "" : field.value}
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
            <input type="checkbox" {...form.register("registrationManualClosed")} disabled={pending} />
            Tutup registrasi secara manual (formulir diblokir)
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Harga tiket</h2>
          <Field label="Sumber harga">
            <select
              value={pricingSource}
              disabled={pending}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              onChange={(e) => {
                const next = e.target.value as AdminEventUpsertInput["pricingSource"];
                form.setValue("pricingSource", next, { shouldDirty: true });
                if (next === "global_default") pickCommitteePrices();
              }}
            >
              <option value="global_default">Default komite</option>
              <option value="overridden">Override per acara</option>
            </select>
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
                {...form.register("ticketNonMemberPrice", { valueAsNumber: true })}
              />
            </Field>
          </div>
          <p className="text-muted-foreground text-xs">
            Jika memilih default komite, nilai akan disimpan dari{" "}
            <code>MATCH_DEFAULT_TICKET_*_IDR</code> di server pada saat simpan.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Konfigurasi menu</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mode menu">
              <select
                value={menuMode}
                disabled={pending || lockedMenuKeys.includes("menuMode")}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                onChange={(e) =>
                  form.setValue("menuMode", e.target.value as AdminEventUpsertInput["menuMode"], {
                    shouldDirty: true,
                  })
                }
              >
                <option value="PRESELECT">Pilih menu di form</option>
                <option value="VOUCHER">Voucher</option>
              </select>
              {lockedMenuKeys.includes("menuMode") ? (
                <Muted>Terhubung pada pendaftar — tidak dapat diubah.</Muted>
              ) : null}
            </Field>
            <Field label="Pilihan menu">
              <select
                value={menuSelection}
                disabled={pending || lockedMenuKeys.includes("menuSelection")}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                onChange={(e) =>
                  form.setValue(
                    "menuSelection",
                    e.target.value as AdminEventUpsertInput["menuSelection"],
                    { shouldDirty: true },
                  )
                }
              >
                <option value="SINGLE">Satu opsi per tiket</option>
                <option value="MULTI">Multi pilih per tiket</option>
              </select>
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
              placeholder={menuMode === "VOUCHER" ? "Wajib" : "Hanya mode Voucher"}
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
                  <Input {...form.register(`menuItems.${index}.name`)} disabled={pending} />
                </Field>
                <Field label="Harga (IDR)" className="w-32">
                  <Input
                    type="number"
                    min={0}
                    disabled={pending}
                    {...form.register(`menuItems.${index}.priceIdr`, { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Urutan" className="w-24">
                  <Input
                    type="number"
                    min={0}
                    disabled={pending}
                    {...form.register(`menuItems.${index}.sortOrder`, { valueAsNumber: true })}
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
            <select
              value={picId}
              disabled={pending}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              onChange={(e) => {
                const next = e.target.value;
                form.setValue("picMasterMemberId", next, { shouldDirty: true });
                const first = props.banksByPic[next]?.[0]?.id ?? "";
                form.setValue("bankAccountId", first, { shouldDirty: true });
              }}
            >
              {props.picOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rekening pembayaran">
            <select
              value={bankAccountId}
              disabled={pending || bankChoices.length === 0}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              onChange={(e) =>
                form.setValue("bankAccountId", e.target.value, { shouldDirty: true })
              }
            >
              {bankChoices.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            {bankChoices.length === 0 ? (
              <Muted>Tidak ada rekening aktif untuk PIC ini — tambahkan di pengaturan komite.</Muted>
            ) : null}
          </Field>

          <Field label={`PIC pembantu (${helpersSelected.length})`}>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-3">
              {props.picOptions.map((p) => {
                const checked = helpersSelected.includes(p.id);
                const isPicMaster = picId === p.id;
                return (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={pending || isPicMaster}
                      checked={checked}
                      onChange={() => {
                        const cur =
                          form.getValues("helperMasterMemberIds") ?? ([] as string[]);
                        if (checked)
                          form.setValue(
                            "helperMasterMemberIds",
                            cur.filter((x) => x !== p.id),
                            { shouldDirty: true },
                          );
                        else form.setValue("helperMasterMemberIds", [...cur, p.id], { shouldDirty: true });
                      }}
                    />
                    <span className={cn(isPicMaster && "text-muted-foreground")}>
                      {p.label}
                      {isPicMaster ? " (PIC utama)" : ""}
                    </span>
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
          <Link href="/admin/events" className={buttonVariants({ variant: "outline" })}>
            Batal
          </Link>
        </div>
      </form>

      <Dialog open={pendingAcknowledge} onOpenChange={setPendingAcknowledge}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi perubahan sensitif</DialogTitle>
            <DialogDescription>
              Anda mengubah harga tiket/voucher, sumber harga, PIC utama, atau rekening. Pastikan
              ini disengaja sebelum melanjutkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPendingAcknowledge(false)}>
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
