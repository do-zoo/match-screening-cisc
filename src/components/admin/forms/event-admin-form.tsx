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
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";

import { createAdminEvent, updateAdminEvent } from "@/lib/actions/admin-events";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
import {
  adminEventUpsertSchema,
  type AdminEventUpsertInput,
  type LinkedVenueMenuItemDraft,
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
import { IdrAmountInput } from "@/components/ui/idr-amount-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatIdr } from "@/lib/utils/format-idr";
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
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { ImageUploadDropzone } from "@/components/ui/image-upload-dropzone";
import { FieldGroup } from "@/components/ui/field";

const SENSITIVE_ACK_MESSAGE =
  "Centang pengakuan untuk mengubah harga tiket, PIC utama, atau rekening pembayaran.";

export type EventAdminPicOption = { id: string; label: string };

export type VenueOptionForEventAdmin = {
  id: string;
  name: string;
  menuItems: Array<{
    id: string;
    name: string;
    price: number;
    sortOrder: number;
  }>;
};

/** Stable fallback so `useWatch` `?? []` does not allocate a fresh array each render. */
const FALLBACK_LINKED_VENUE_MENU_ITEMS: LinkedVenueMenuItemDraft[] = [];

export type EventAdminFormProps = {
  mode: "create" | "edit";
  eventId?: string;
  defaults: AdminEventUpsertInput;
  registrationCount?: number;
  persistedIntegrity?: EventIntegritySnapshot | null;
  /** Admin profiles eligible as event PIC (financial owner). */
  picOptions: EventAdminPicOption[];
  banksByPic: Record<string, Array<{ id: string; label: string }>>;
  /** Admin profiles eligible as PIC pembantu (same pool as PIC; PIC excluded in form). */
  helperAdminOptions: EventAdminPicOption[];
  /** Venue aktif + katalog menu kanonik (semua item dihubungkan ke acara bila belum ada pendaftar). */
  venueOptions: VenueOptionForEventAdmin[];
  /** Pratinjau sampul yang sudah tersimpan (mode edit). */
  persistedCoverUrl?: string | null;
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
      venueId: props.defaults.venueId,
      mandatoryMenuItemIds: props.defaults.mandatoryMenuItemIds,
      ticketMemberPrice: props.defaults.ticketMemberPrice,
      ticketNonMemberPrice: props.defaults.ticketNonMemberPrice,
      picAdminProfileId: props.defaults.picAdminProfileId,
      bankAccountId: props.defaults.bankAccountId,
    } satisfies EventIntegritySnapshot);

  const venueOptions = props.venueOptions;

  const form = useForm<AdminEventUpsertInput>({
    resolver: zodResolver(
      adminEventUpsertSchema as never,
    ) as Resolver<AdminEventUpsertInput>,
    defaultValues: props.defaults,
  });

  const venueId = useWatch({ control: form.control, name: "venueId" });

  const currentVenue = useMemo(() => {
    return venueOptions.find((v) => v.id === venueId) ?? null;
  }, [venueOptions, venueId]);

  const picId = useWatch({ control: form.control, name: "picAdminProfileId" });
  const bankAccountId = useWatch({
    control: form.control,
    name: "bankAccountId",
  });
  const helpersSelected =
    useWatch({
      control: form.control,
      name: "helperAdminProfileIds",
    }) ?? [];

  const bankChoices = useMemo(() => {
    return props.banksByPic[picId] ?? [];
  }, [props.banksByPic, picId]);

  const venueComboboxOptions = useMemo(
    () =>
      venueOptions.map((v) => ({
        value: v.id,
        label: v.name,
        keywords: v.name,
      })),
    [venueOptions],
  );

  const picComboboxOptions = useMemo(
    () =>
      props.picOptions.map((p) => ({
        value: p.id,
        label: p.label,
        keywords: p.label,
      })),
    [props.picOptions],
  );

  const bankComboboxOptions = useMemo(
    () =>
      bankChoices.map((b) => ({
        value: b.id,
        label: b.label,
        keywords: b.label,
      })),
    [bankChoices],
  );

  const lockedIntegrityKeys = useMemo(() => {
    return findLockedViolations({
      registrationCount,
      persisted: persistedIntegrity,
      candidate: {
        venueId,
      },
    });
  }, [registrationCount, persistedIntegrity, venueId]);

  const mandatoryMenuLocked = registrationCount > 0;

  const setLinkedVenueMenusFromVenueSelection = React.useCallback(
    (vid: string) => {
      const v = venueOptions.find((o) => o.id === vid);
      if (!v) {
        form.setValue("linkedVenueMenuItems", [], { shouldDirty: true });
        return;
      }
      const sorted = [...v.menuItems].sort((a, b) => a.sortOrder - b.sortOrder);
      form.setValue(
        "linkedVenueMenuItems",
        sorted.map((m, idx) => ({
          venueMenuItemId: m.id,
          sortOrder: idx,
        })),
        { shouldDirty: true },
      );
    },
    [form, venueOptions],
  );

  const linkedVenueMenus =
    useWatch({ control: form.control, name: "linkedVenueMenuItems" }) ??
    FALLBACK_LINKED_VENUE_MENU_ITEMS;

  const mandatoryMenuItemIds =
    useWatch({ control: form.control, name: "mandatoryMenuItemIds" }) ?? [];

  useEffect(() => {
    const linkedIds = linkedVenueMenus.map((x) => x.venueMenuItemId);
    const cur = form.getValues("mandatoryMenuItemIds") ?? [];
    const filtered = cur.filter((id) => linkedIds.includes(id));
    const next =
      filtered.length > 0
        ? filtered
        : linkedIds.length > 0
          ? [linkedIds[0]!]
          : [];
    if (JSON.stringify(cur) !== JSON.stringify(next)) {
      form.setValue("mandatoryMenuItemIds", next, { shouldDirty: true });
    }
  }, [linkedVenueMenus, form]);

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
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Sampul</h2>
          <p className="text-muted-foreground text-sm">
            {props.mode === "create"
              ? "Unggah gambar sampul — wajib untuk acara baru."
              : "Unggah gambar baru bila ingin mengganti sampul (opsional)."}{" "}
            Rasio yang direkomendasikan 1200×630 (sama dengan og:image); area di
            luar rasio ini akan dipangkas saat ditampilkan.
          </p>
          <ImageUploadDropzone
            value={props.persistedCoverUrl ?? undefined}
            onChange={(file) => setCoverFile(file)}
            disabled={pending}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Ringkasan</h2>
          <Field label="Ringkasan">
            <Textarea
              {...form.register("summary")}
              disabled={pending}
              className="resize-y"
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Deskripsi</h2>
          <Field label="Konten publik">
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

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Venue</h2>
          <Field label="Venue">
            <Controller
              control={form.control}
              name="venueId"
              render={({ field }) => (
                <EntityCombobox
                  placeholder="Pilih venue"
                  value={field.value === "" ? null : field.value}
                  onValueChange={(next) => {
                    if (next === null) return;
                    field.onChange(next);
                    setLinkedVenueMenusFromVenueSelection(next);
                  }}
                  options={venueComboboxOptions}
                  disabled={pending || lockedIntegrityKeys.includes("venueId")}
                />
              )}
            />
            {lockedIntegrityKeys.includes("venueId") ? (
              <Muted>
                Terhubung pada pendaftar — venue tidak dapat diubah.
              </Muted>
            ) : (
              <p className="text-muted-foreground text-xs">
                Menu di formulir pengunjung diturunkan dari katalog venue. Ubah
                nama/harga menu di pengelola venue.
              </p>
            )}
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Menu wajib (per tiket)</h2>
          <p className="text-muted-foreground text-xs">
            Pengunjung memilih satu item berikut untuk setiap tiket (utama dan
            partner). Daftar mengikuti menu kanonik venue (semua item di acara
            bila belum ada pendaftar; setelah ada pendaftar, snapshot menu acara
            dikunci).
          </p>
          {linkedVenueMenus.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Pilih venue yang memiliki setidaknya satu item menu kanonik.
            </p>
          ) : (
            <div className="border-muted bg-card space-y-2 rounded-lg border p-4">
              <div className="flex flex-col gap-2">
                {linkedVenueMenus.flatMap((row) => {
                  const meta = currentVenue?.menuItems.find(
                    (mi) => mi.id === row.venueMenuItemId,
                  );
                  if (!meta) return [];
                  const mid = row.venueMenuItemId;
                  const checked = mandatoryMenuItemIds.includes(mid);
                  return [
                    <label
                      key={mid}
                      className="hover:bg-accent/60 flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={checked}
                        disabled={pending || mandatoryMenuLocked}
                        onChange={(e) => {
                          const cur = new Set(
                            form.getValues("mandatoryMenuItemIds") ?? [],
                          );
                          if (e.target.checked) {
                            cur.add(mid);
                          } else {
                            cur.delete(mid);
                          }
                          let next = [...cur];
                          if (next.length === 0 && linkedVenueMenus[0]) {
                            next = [linkedVenueMenus[0]!.venueMenuItemId];
                          }
                          form.setValue("mandatoryMenuItemIds", next, {
                            shouldDirty: true,
                          });
                        }}
                      />
                      <span>
                        <span className="font-medium">{meta.name}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {formatIdr(meta.price)}
                        </span>
                      </span>
                    </label>,
                  ];
                })}
              </div>
              {mandatoryMenuLocked ? (
                <Muted>
                  Terhubung pada pendaftar — set menu wajib tidak dapat diubah.
                </Muted>
              ) : null}
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-lg font-medium sm:col-span-2">
            Jadwal registrasi
          </h2>
          <Field label="Buka registrasi">
            <Controller
              control={form.control}
              name="openRegistrationAtIso"
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
          <Field label="Tutup registrasi">
            <Controller
              control={form.control}
              name="closeRegistrationAtIso"
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
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-lg font-medium sm:col-span-2">Jadwal acara</h2>
          <Field label="Buka gate">
            <Controller
              control={form.control}
              name="openGateAtIso"
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
          <Field label="Kick-off acara">
            <Controller
              control={form.control}
              name="kickOffAtIso"
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
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Harga tiket</h2>
          <p className="text-muted-foreground text-xs">
            Harga disimpan per acara sebagai bilangan bulat Rupiah (tanpa desimal).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tiket member">
              <Controller
                control={form.control}
                name="ticketMemberPrice"
                render={({ field, fieldState }) => (
                  <IdrAmountInput
                    disabled={pending}
                    aria-invalid={fieldState.invalid}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </Field>
            <Field label="Tiket non-member">
              <Controller
                control={form.control}
                name="ticketNonMemberPrice"
                render={({ field, fieldState }) => (
                  <IdrAmountInput
                    disabled={pending}
                    aria-invalid={fieldState.invalid}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </Field>
          </div>
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
          <h2 className="text-lg font-medium">PIC & rekening</h2>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field label="PIC utama">
              <EntityCombobox
                placeholder="Pilih PIC"
                value={picId === "" ? null : picId}
                onValueChange={(next) => {
                  if (next === null) return;
                  form.setValue("picAdminProfileId", next, {
                    shouldDirty: true,
                  });
                  const first = props.banksByPic[next]?.[0]?.id ?? "";
                  form.setValue("bankAccountId", first, { shouldDirty: true });
                }}
                options={picComboboxOptions}
                disabled={pending}
              />
            </Field>
            <Field label="Rekening pembayaran">
              <EntityCombobox
                placeholder="Pilih rekening"
                value={bankAccountId === "" ? null : bankAccountId}
                onValueChange={(v) => {
                  if (v === null) return;
                  form.setValue("bankAccountId", v, { shouldDirty: true });
                }}
                disabled={pending || bankChoices.length === 0}
                options={bankComboboxOptions}
              />
              {bankChoices.length === 0 ? (
                <Muted>
                  Tidak ada rekening aktif untuk PIC ini — tambahkan di
                  pengaturan komite.
                </Muted>
              ) : null}
            </Field>
          </FieldGroup>

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
              Anda mengubah harga tiket, PIC utama, atau rekening pembayaran.
              Pastikan ini disengaja sebelum melanjutkan.
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
