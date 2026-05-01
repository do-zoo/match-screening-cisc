"use client";

import { Controller, type Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

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
    <section className="grid gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <Controller
        control={control}
        name="qtyPartner"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="ms-registration-qty-partner">
              Bawa tiket partner
            </FieldLabel>
            <Input
              id="ms-registration-qty-partner"
              name="qtyPartner"
              type="checkbox"
              checked={Number(field.value) === 1}
              onChange={(e) => field.onChange(e.target.checked ? 1 : 0)}
            />
            {fieldState.invalid && (
              <FieldError errors={[fieldState.error]} />
            )}
          </Field>
        )}
      />

      {Number(qtyPartner ?? 0) === 1 ? (
        <div className="grid gap-4">
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
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={control}
            name="partnerWhatsapp"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ms-registration-partner-whatsapp">
                  WhatsApp partner (opsional)
                </FieldLabel>
                <Input
                  id="ms-registration-partner-whatsapp"
                  inputMode="tel"
                  autoComplete="tel"
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={control}
            name="partnerMemberNumber"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ms-registration-partner-member-number">
                  Nomor member partner (opsional)
                </FieldLabel>
                <Input
                  id="ms-registration-partner-member-number"
                  autoComplete="off"
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
      ) : null}
    </section>
  );
}
