"use client";

import {
  Controller,
  type Control,
  type UseFormClearErrors,
  type UseFormSetValue,
} from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
  MEMBER_NUMBER_REQUIRED_WHEN_PARTNER_IS_MEMBER_MESSAGE,
  type SubmitRegistrationInput,
} from "@/lib/forms/submit-registration-schema";

import { cn } from "@/lib/utils";

import type { PartnerMemberNumberGateState } from "./types";

type Props = {
  control: Control<SubmitRegistrationInput>;
  setValue: UseFormSetValue<SubmitRegistrationInput>;
  clearErrors: UseFormClearErrors<SubmitRegistrationInput>;
  showPartnerSection: boolean;
  qtyPartner: unknown;
  partnerIsMember: boolean;
  partnerDirectoryVerified: boolean;
  effectivePartnerMemberGate: PartnerMemberNumberGateState;
};

export function PartnerTicketSection({
  control,
  setValue,
  clearErrors,
  showPartnerSection,
  qtyPartner,
  partnerIsMember,
  partnerDirectoryVerified,
  effectivePartnerMemberGate,
}: Props) {
  if (!showPartnerSection) return null;

  const qtyChecked = Number(qtyPartner ?? 0) === 1;

  return (
    <section aria-label="Tiket partner" className="grid gap-5 rounded-xl">
      <Controller
        control={control}
        name="qtyPartner"
        render={({ field, fieldState }) => (
          <Field
            orientation="horizontal"
            data-invalid={fieldState.invalid}
            className="items-start gap-3"
          >
            <Checkbox
              id="ms-registration-qty-partner"
              aria-invalid={fieldState.invalid}
              checked={Number(field.value) === 1}
              onCheckedChange={(checked) => {
                field.onChange(checked === true ? 1 : 0);
              }}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <FieldLabel
                htmlFor="ms-registration-qty-partner"
                className="cursor-pointer leading-snug"
              >
                Bawa tiket partner
              </FieldLabel>
              <FieldDescription className="text-foreground/75">
                Centang untuk menambahkan satu tiket partner (sesuai ketentuan
                acara). Data partner akan diminta di bawah.
              </FieldDescription>
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </div>
          </Field>
        )}
      />

      {qtyChecked ? (
        <div className="grid gap-5 border-t border-border/80 pt-5">
          <Controller
            control={control}
            name="partnerIsMember"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel id="ms-registration-partner-membership-heading">
                  Status tiket partner
                </FieldLabel>
                <RadioGroup
                  className="grid gap-3 sm:grid-cols-2"
                  aria-labelledby="ms-registration-partner-membership-heading"
                  value={field.value ? "member" : "non"}
                  onValueChange={(val) => {
                    const member = val === "member";
                    field.onChange(member);
                    field.onBlur();
                    if (!member) {
                      setValue("partnerMemberNumber", "", {
                        shouldValidate: true,
                      });
                      setValue("partnerMemberCardPhoto", undefined, {
                        shouldValidate: false,
                      });
                      clearErrors([
                        "partnerMemberNumber",
                        "partnerMemberCardPhoto",
                      ]);
                    }
                  }}
                >
                  <Label
                    htmlFor="ms-registration-partner-status-member"
                    className={cn(
                      "flex min-h-12 cursor-pointer touch-manipulation flex-row items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left text-sm shadow-sm outline-none hover:bg-muted/35 has-data-checked:border-primary has-data-checked:bg-primary/4",
                    )}
                  >
                    <RadioGroupItem
                      value="member"
                      id="ms-registration-partner-status-member"
                      className="mt-1"
                    />
                    <span className="font-medium leading-snug">
                      Member CISC partner{" "}
                      <span className="font-normal text-muted-foreground">
                        (tiket member)
                      </span>
                    </span>
                  </Label>
                  <Label
                    htmlFor="ms-registration-partner-status-non-member"
                    className={cn(
                      "flex min-h-12 cursor-pointer touch-manipulation flex-row items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left text-sm shadow-sm outline-none hover:bg-muted/35 has-data-checked:border-primary has-data-checked:bg-primary/4",
                    )}
                  >
                    <RadioGroupItem
                      value="non"
                      id="ms-registration-partner-status-non-member"
                      className="mt-1"
                    />
                    <span className="font-medium leading-snug">
                      Bukan member partner{" "}
                      <span className="font-normal text-muted-foreground">
                        (tiket umum)
                      </span>
                    </span>
                  </Label>
                </RadioGroup>
                <FieldDescription className="text-foreground/80">
                  Menentukan harga tiket partner. Untuk tiket member, nomor akan
                  divalidasi di direktori seperti nomor Anda sebelum foto kartu.
                </FieldDescription>
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />

          {!partnerIsMember ? (
            <>
              <Field>
                <FieldDescription className="text-foreground/80">
                  Harga tiket partner mengikuti tarif non-member. Isi nama
                  partner untuk identitas tiket ini.
                </FieldDescription>
              </Field>

              <Controller
                control={control}
                name="partnerName"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ms-registration-partner-name">
                      Nama partner
                    </FieldLabel>
                    <Input
                      id="ms-registration-partner-name"
                      autoComplete="name"
                      {...field}
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="partnerWhatsapp"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ms-registration-partner-whatsapp">
                      WhatsApp partner{" "}
                      <span className="font-normal text-muted-foreground">
                        (opsional)
                      </span>
                    </FieldLabel>
                    <Input
                      id="ms-registration-partner-whatsapp"
                      inputMode="tel"
                      autoComplete="tel"
                      {...field}
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
            </>
          ) : null}

          {partnerIsMember ? (
            <>
              <Controller
                control={control}
                name="partnerMemberNumber"
                render={({ field, fieldState }) => {
                  const memberTrim = String(field.value ?? "").trim();
                  return (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="ms-registration-partner-member-number">
                        Nomor member partner{" "}
                        <span className="font-normal text-muted-foreground">
                          (wajib)
                        </span>
                      </FieldLabel>
                      <Input
                        id="ms-registration-partner-member-number"
                        autoComplete="off"
                        {...field}
                        value={field.value ?? ""}
                        required={partnerIsMember}
                        aria-required={partnerIsMember}
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldDescription className="text-foreground/80">
                        {MEMBER_NUMBER_REQUIRED_WHEN_PARTNER_IS_MEMBER_MESSAGE}{" "}
                        Foto kartu member partner akan diminta{" "}
                        <span className="font-medium text-foreground">
                          setelah nomor dikenali
                        </span>{" "}
                        di direktori.
                      </FieldDescription>
                      {memberTrim.length > 0 &&
                      effectivePartnerMemberGate.status === "checking" ? (
                        <FieldDescription className="text-foreground/80">
                          Memeriksa data member di direktori…
                        </FieldDescription>
                      ) : null}
                      {effectivePartnerMemberGate.status === "ready" &&
                      effectivePartnerMemberGate.found &&
                      effectivePartnerMemberGate.seatForEvent === "taken" ? (
                        <Alert variant="destructive" className="mt-2">
                          <span>{MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE}</span>
                        </Alert>
                      ) : fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  );
                }}
              />

              {partnerDirectoryVerified ? (
                <>
                  <Controller
                    control={control}
                    name="partnerMemberCardPhoto"
                    render={({
                      field: { ref, name, onBlur, onChange },
                      fieldState,
                    }) => (
                      <FileField
                        ref={ref}
                        id="ms-registration-partner-member-card-photo"
                        label={
                          <>
                            Foto kartu member partner{" "}
                            <span className="font-normal text-muted-foreground">
                              (wajib)
                            </span>
                          </>
                        }
                        description={
                          <>
                            Format JPG, PNG, atau WebP; pastikan nomor dan nama
                            pada kartu partner terbaca jelas.
                          </>
                        }
                        name={name}
                        onBlur={onBlur}
                        onChange={onChange}
                        invalid={fieldState.invalid}
                        required
                        errors={
                          fieldState.error ? [fieldState.error] : undefined
                        }
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="partnerName"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="ms-registration-partner-name">
                          Nama partner
                        </FieldLabel>
                        <Input
                          id="ms-registration-partner-name"
                          autoComplete="name"
                          {...field}
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                  <Controller
                    control={control}
                    name="partnerWhatsapp"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="ms-registration-partner-whatsapp">
                          WhatsApp partner{" "}
                          <span className="font-normal text-muted-foreground">
                            (opsional)
                          </span>
                        </FieldLabel>
                        <Input
                          id="ms-registration-partner-whatsapp"
                          inputMode="tel"
                          autoComplete="tel"
                          {...field}
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
