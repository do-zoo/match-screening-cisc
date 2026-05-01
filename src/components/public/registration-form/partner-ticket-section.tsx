"use client";

import { Controller, type Control } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

type Props = {
  control: Control<SubmitRegistrationInput>;
  showPartnerSection: boolean;
  qtyPartner: unknown;
};

export function PartnerTicketSection({
  control,
  showPartnerSection,
  qtyPartner,
}: Props) {
  if (!showPartnerSection) return null;

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

      {Number(qtyPartner ?? 0) === 1 ? (
        <div className="grid gap-5 border-t border-border/80 pt-5">
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

          <Controller
            control={control}
            name="partnerMemberNumber"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ms-registration-partner-member-number">
                  Nomor member partner{" "}
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </FieldLabel>
                <Input
                  id="ms-registration-partner-member-number"
                  autoComplete="off"
                  {...field}
                />
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />
        </div>
      ) : null}
    </section>
  );
}
