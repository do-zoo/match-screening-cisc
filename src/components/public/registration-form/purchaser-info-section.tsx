"use client";

import { Controller, type Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { FileField } from "@/components/ui/file-field";

import type { PartnerGateState } from "./types";

type Props = {
  control: Control<SubmitRegistrationInput>;
  claimedMemberTrim: string;
  effectivePartnerGate: PartnerGateState;
};

export function PurchaserInfoSection({
  control,
  claimedMemberTrim,
  effectivePartnerGate,
}: Props) {
  return (
    <section className="grid gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="font-medium">Informasi pemesan</div>
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
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        control={control}
        name="contactWhatsapp"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="ms-registration-whatsapp">WhatsApp</FieldLabel>
            <Input
              {...field}
              id="ms-registration-whatsapp"
              aria-invalid={fieldState.invalid}
              placeholder="WhatsApp Number"
              autoComplete="off"
              inputMode="tel"
            />
            <FieldDescription>
              Gunakan nomor utama yang bisa dihubungi via WhatsApp.
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        control={control}
        name="claimedMemberNumber"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="ms-registration-member-number">
              Nomor member (opsional)
            </FieldLabel>
            <Input
              {...field}
              id="ms-registration-member-number"
              placeholder="Contoh: CISC-xxxx"
              value={field.value ?? ""}
            />
            <FieldDescription>
              Jika diisi, harga akan mengikuti harga member.
            </FieldDescription>
            {claimedMemberTrim.length > 0 &&
            effectivePartnerGate.status === "checking" ? (
              <FieldDescription>
                Memeriksa data member di direktori…
              </FieldDescription>
            ) : null}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {claimedMemberTrim.length > 0 ? (
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
              label="Foto kartu member"
              description={
                <>
                  Wajib jika nomor member diisi. Gunakan JPG, PNG, atau WebP;
                  pastikan nomor dan nama pada kartu terbaca dengan jelas.
                </>
              }
              name={name}
              onBlur={onBlur}
              onChange={onChange}
              invalid={fieldState.invalid}
              errors={
                fieldState.error ? [fieldState.error] : undefined
              }
            />
          )}
        />
      ) : null}
    </section>
  );
}
