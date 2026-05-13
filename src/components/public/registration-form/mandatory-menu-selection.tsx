"use client";

import { Controller, type Control } from "react-hook-form";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";
import { formatIdr } from "@/lib/utils/format-idr";

type Props = {
  control: Control<SubmitRegistrationInput>;
  event: SerializedEventForRegistration;
  label?: string;
  fieldName: "primaryMandatoryMenuItemId" | "partnerMandatoryMenuItemId";
};

export function MandatoryMenuSelection({
  control,
  event,
  label = "Pilih 1 menu (wajib):",
  fieldName,
}: Props) {
  return (
    <section aria-label="Pilihan menu wajib" className="rounded-xl">
      <Controller
        control={control}
        name={fieldName}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>{label}</FieldLabel>
            <RadioGroup
              value={field.value ?? ""}
              onValueChange={field.onChange}
              className="grid gap-3"
            >
              {event.mandatoryMenuItems.map((item) => (
                <div key={item.id} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={item.id}
                    id={`menu-${fieldName}-${item.id}`}
                  />
                  <label
                    htmlFor={`menu-${fieldName}-${item.id}`}
                    className="flex flex-1 cursor-pointer items-center justify-between rounded-md border p-3 hover:bg-accent"
                  >
                    <span>{item.name}</span>
                    <span className="text-sm font-medium">
                      {formatIdr(item.price)}
                    </span>
                  </label>
                </div>
              ))}
            </RadioGroup>
            {fieldState.invalid ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </Field>
        )}
      />
    </section>
  );
}
