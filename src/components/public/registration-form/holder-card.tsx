"use client";

import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

type Props = {
  index: number;
  isPrimary: boolean;
  menuItems?: { id: string; name: string; price: number }[];
  menuRequired: boolean;
};

export function HolderCard({ index, isPrimary, menuItems, menuRequired }: Props) {
  const [expanded, setExpanded] = useState(isPrimary);
  const form = useFormContext<SubmitRegistrationInput>();

  const holderName = form.watch(`holders.${index}.holderName`);
  const memberNumber = form.watch(`holders.${index}.claimedMemberNumber`);

  const summary = holderName
    ? `${holderName}${memberNumber ? ` · ${memberNumber}` : ""}`
    : "Belum diisi";

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-medium">
          Tiket {index + 1}
          {isPrimary && " (Anda)"}
        </span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{summary}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <Controller
            control={form.control}
            name={`holders.${index}.holderName`}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`holder-${index}-name`}>Nama Lengkap</FieldLabel>
                <Input
                  id={`holder-${index}-name`}
                  placeholder="Nama sesuai identitas"
                  {...field}
                />
                {fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name={`holders.${index}.claimedMemberNumber`}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`holder-${index}-member`}>
                  Nomor Member CISC (opsional)
                </FieldLabel>
                <Input
                  id={`holder-${index}-member`}
                  placeholder="Kosongkan jika bukan member"
                  {...field}
                />
                {fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {menuRequired && menuItems && menuItems.length > 0 && (
            <Controller
              control={form.control}
              name={`holders.${index}.mandatoryMenuItemId`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`holder-${index}-menu`}>Pilihan Menu</FieldLabel>
                  <select
                    id={`holder-${index}-menu`}
                    className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                  >
                    <option value="">-- Pilih menu --</option>
                    {menuItems.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
