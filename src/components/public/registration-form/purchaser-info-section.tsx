"use client";

import { useMemo, useState } from "react";
import {
  Controller,
  useWatch,
  type Control,
  type UseFormClearErrors,
  type UseFormSetValue,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MEMBER_NUMBER_REQUIRED_WHEN_MEMBER_MESSAGE,
  type SubmitRegistrationInput,
} from "@/lib/forms/submit-registration-schema";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { FileField } from "@/components/ui/file-field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { cn } from "@/lib/utils";
import { PencilLine, ShieldCheck } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import {
  contactInitials,
  maskDisplayName,
  maskDisplayWhatsapp,
} from "./mask-contact-display";
import type { PartnerGateState } from "./types";

type Props = {
  control: Control<SubmitRegistrationInput>;
  setValue: UseFormSetValue<SubmitRegistrationInput>;
  clearErrors: UseFormClearErrors<SubmitRegistrationInput>;
  claimedMemberTrim: string;
  effectivePartnerGate: PartnerGateState;
};

/** Kartu ringkas bergaya profile card (visual mirip pola React Bits Profile Card — reactbits.dev). Bukan enkripsi kriptografi, hanya penyamaran tampilan. */
function DirectoryContactProfileCard({
  maskedName,
  maskedWhatsapp,
  initials,
  onEdit,
}: {
  maskedName: string;
  maskedWhatsapp: string;
  initials: string;
  onEdit: () => void;
}) {
  return (
    <Field className="min-w-0">
      <div className="flex flex-row flex-wrap items-end justify-between gap-3">
        <FieldLabel className="text-base">
          Identitas pemesan dari direktori
        </FieldLabel>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 touch-manipulation gap-2"
          onClick={onEdit}
        >
          <PencilLine className="size-4 shrink-0" aria-hidden />
          Ubah nama &amp; WhatsApp
        </Button>
      </div>
      <div
        role="region"
        aria-label="Data kontak disamarkan. Gunakan tombol ubah untuk menampilkan bidang lengkap dan mengedit."
        className={cn(
          "relative mt-3 min-h-11 overflow-hidden rounded-2xl shadow-md ring-1 ring-primary/20 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
        )}
      >
        <div className="flex flex-row gap-4 rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.06] px-4 py-4 backdrop-blur-sm dark:to-primary/[0.04]">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-lg font-semibold text-primary-foreground shadow-inner"
            aria-hidden
          >
            {initials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-row flex-wrap items-center gap-2 gap-y-1">
              <ShieldCheck
                className="size-4 shrink-0 text-primary"
                aria-hidden
              />
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                Terverifikasi di direktori
              </span>
            </div>
            <div className="grid min-w-0 gap-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Nama
                </p>
                <p
                  className="truncate text-lg font-semibold tracking-tight text-foreground"
                  aria-hidden="true"
                >
                  {maskedName}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  WhatsApp
                </p>
                <p
                  className="font-mono text-base leading-relaxed tracking-wide text-muted-foreground"
                  aria-hidden="true"
                >
                  {maskedWhatsapp || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FieldDescription className="text-foreground/80">
        Teks disamarkan agar lebih sulit dibaca orang lain dari samping; Anda
        tetap bisa mengubah isi aktual untuk pendaftaran melalui
        &quot;Ubah&quot;.
      </FieldDescription>
    </Field>
  );
}

export function PurchaserInfoSection({
  control,
  setValue,
  clearErrors,
  claimedMemberTrim,
  effectivePartnerGate,
}: Props) {
  const purchaserIsMember = Boolean(
    useWatch({ control, name: "purchaserIsMember" })
  );
  const contactName = String(useWatch({ control, name: "contactName" }) ?? "");
  const contactWhatsapp = String(
    useWatch({ control, name: "contactWhatsapp" }) ?? ""
  );

  /** Hanya bermakna saat direktori terverifikasi; jangan mengandalkan saat gagal/struck. */
  const [contactsShowInputs, setContactsShowInputs] = useState(false);

  const directoryVerified = useMemo(() => {
    return (
      purchaserIsMember &&
      claimedMemberTrim.length > 0 &&
      effectivePartnerGate.status === "ready" &&
      effectivePartnerGate.found &&
      effectivePartnerGate.forTrim === claimedMemberTrim
    );
  }, [purchaserIsMember, claimedMemberTrim, effectivePartnerGate]);

  const editingWhileVerified = directoryVerified && contactsShowInputs;

  const showMaskedProfileCard =
    directoryVerified &&
    contactName.trim().length >= 2 &&
    !editingWhileVerified;

  /** Sama dengan ambang tampilan mask + min Zod WhatsApp (8). */
  const whatsappLooksEmpty = contactWhatsapp.trim().length < 8;
  const showWhatsappFillHint = directoryVerified && whatsappLooksEmpty;

  return (
    <section aria-label="Informasi pemesan" className="grid gap-5 rounded-xl">
      <Controller
        control={control}
        name="purchaserIsMember"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id="ms-registration-membership-heading">
              Status Anda sebagai pemesan
            </FieldLabel>
            <RadioGroup
              className="grid gap-3 sm:grid-cols-2"
              aria-labelledby="ms-registration-membership-heading"
              value={field.value ? "member" : "non"}
              onValueChange={(val) => {
                const member = val === "member";
                field.onChange(member);
                field.onBlur();
                if (!member) {
                  setValue("claimedMemberNumber", undefined, {
                    shouldValidate: true,
                  });
                  setValue("memberCardPhoto", undefined, {
                    shouldValidate: false,
                  });
                  clearErrors(["claimedMemberNumber", "memberCardPhoto"]);
                }
              }}
            >
              <Label
                htmlFor="ms-registration-status-member"
                className={cn(
                  "flex min-h-12 cursor-pointer touch-manipulation flex-row items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left text-sm shadow-sm outline-none hover:bg-muted/35 has-data-checked:border-primary has-data-checked:bg-primary/4"
                )}
              >
                <RadioGroupItem
                  value="member"
                  id="ms-registration-status-member"
                  className="mt-1"
                />
                <span className="font-medium leading-snug">
                  Member CISC{" "}
                  <span className="font-normal text-muted-foreground">
                    (tiket member)
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="ms-registration-status-non-member"
                className={cn(
                  "flex min-h-12 cursor-pointer touch-manipulation flex-row items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left text-sm shadow-sm outline-none hover:bg-muted/35 has-data-checked:border-primary has-data-checked:bg-primary/4"
                )}
              >
                <RadioGroupItem
                  value="non"
                  id="ms-registration-status-non-member"
                  className="mt-1"
                />
                <span className="font-medium leading-snug">
                  Bukan member{" "}
                  <span className="font-normal text-muted-foreground">
                    (tiket umum)
                  </span>
                </span>
              </Label>
            </RadioGroup>
            <FieldDescription className="text-foreground/80">
              Menentukan harga tiket. Jika Anda member dan nomor dikenali dari
              direktori, identitas Anda ditampilkan dalam kartu disamarkan; ubah
              kapan pun ke bidang biasa untuk mengoreksi atau melengkapkan.
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {!purchaserIsMember ? (
        <Field>
          <FieldDescription className="text-foreground/80">
            Harga mengikuti tiket non-member. Isi nama dan nomor WhatsApp Anda
            di bawah untuk kontak konfirmasi.
          </FieldDescription>
        </Field>
      ) : null}

      {purchaserIsMember ? (
        <>
          <Controller
            control={control}
            name="claimedMemberNumber"
            render={({ field: mField, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ms-registration-member-number">
                  Nomor member{" "}
                  <span className="font-normal text-muted-foreground">
                    (wajib)
                  </span>
                </FieldLabel>
                <Input
                  {...mField}
                  id="ms-registration-member-number"
                  placeholder="Contoh: CISC-xxxx"
                  value={mField.value ?? ""}
                  autoComplete="off"
                  required={purchaserIsMember}
                  aria-required={purchaserIsMember}
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription className="text-foreground/80">
                  {MEMBER_NUMBER_REQUIRED_WHEN_MEMBER_MESSAGE} {""}
                  Nama, WhatsApp, dan pengunggahan foto kartu muncul hanya {""}
                  <span className="font-medium text-foreground">
                    setelah nomor dikenali sebagai member aktif
                  </span>{" "}
                  di direktori. Data kontak bisa diisi otomatis dari direktori;
                  {""}
                  <span className="font-medium text-foreground">
                    foto kartu
                  </span>{" "}
                  tetap diperlukan setelah itu.
                </FieldDescription>
                {claimedMemberTrim.length > 0 &&
                effectivePartnerGate.status === "checking" ? (
                  <FieldDescription className="text-foreground/80">
                    Memeriksa data member di direktori…
                  </FieldDescription>
                ) : null}
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {directoryVerified ? (
            <Controller
              control={control}
              name="memberCardPhoto"
              render={({
                field: { ref, name, onBlur, onChange },
                fieldState,
              }) => (
                <FileField
                  ref={ref}
                  id="ms-registration-member-card-photo"
                  label={
                    <>
                      Foto kartu member{" "}
                      <span className="font-normal text-muted-foreground">
                        (wajib)
                      </span>
                    </>
                  }
                  description={
                    <>
                      Format JPG, PNG, atau WebP; pastikan nomor dan nama pada
                      kartu terbaca jelas.
                    </>
                  }
                  name={name}
                  onBlur={onBlur}
                  onChange={onChange}
                  invalid={fieldState.invalid}
                  required
                  errors={fieldState.error ? [fieldState.error] : undefined}
                />
              )}
            />
          ) : null}
        </>
      ) : null}

      {!purchaserIsMember || directoryVerified ? (
        <>
          {showMaskedProfileCard ? (
            <DirectoryContactProfileCard
              maskedName={maskDisplayName(contactName)}
              maskedWhatsapp={
                contactWhatsapp.trim().length >= 8
                  ? maskDisplayWhatsapp(contactWhatsapp)
                  : ""
              }
              initials={contactInitials(contactName)}
              onEdit={() => setContactsShowInputs(true)}
            />
          ) : (
            <>
              {editingWhileVerified ? (
                <div className="flex flex-row flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    Bidang lengkap tidak disamarkan. Selesai mengisi? Anda bisa
                    kembali ke kartu privat.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="min-h-11 shrink-0 touch-manipulation"
                    onClick={() => setContactsShowInputs(false)}
                  >
                    Tampilkan kartu privat
                  </Button>
                </div>
              ) : null}

              <Controller
                control={control}
                name="contactName"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ms-registration-name">Nama</FieldLabel>
                    <Input
                      {...field}
                      id="ms-registration-name"
                      aria-invalid={fieldState.invalid}
                      placeholder="Nama lengkap"
                      autoComplete="name"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="contactWhatsapp"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ms-registration-whatsapp">
                      WhatsApp
                    </FieldLabel>
                    <Input
                      {...field}
                      id="ms-registration-whatsapp"
                      aria-invalid={fieldState.invalid}
                      placeholder="Nomor utama WhatsApp"
                      autoComplete="off"
                      inputMode="tel"
                    />
                    <FieldDescription className="text-foreground/80">
                      Nomor utama yang bisa dihubungi via WhatsApp.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </>
          )}
          {showWhatsappFillHint ? (
            <Alert variant="destructive">
              {showMaskedProfileCard ? (
                <span>
                  WhatsApp belum terisi atau tidak ada di direktori. Ketuk{" "}
                  <span className="font-medium">Ubah nama &amp; WhatsApp</span>{" "}
                  lalu isi nomor utama agar panitia bisa menghubungi Anda.
                </span>
              ) : (
                <span>
                  Lengkapi bidang <span className="font-medium">WhatsApp</span>{" "}
                  di atas (minimal 8 digit) agar pendaftaran bisa dilanjutkan.
                </span>
              )}
            </Alert>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
