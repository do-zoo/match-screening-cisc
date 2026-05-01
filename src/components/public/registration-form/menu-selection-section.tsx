"use client";

import { Controller, type Control } from "react-hook-form";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

import { formatIdr } from "./format-idr";

type Props = {
  control: Control<SubmitRegistrationInput>;
  event: SerializedEventForRegistration;
};

export function MenuSelectionSection({ control, event }: Props) {
  if (event.menuMode !== "PRESELECT") return null;

  return (
    <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <Controller
        control={control}
        name="selectedMenuItemIds"
        render={({ field, fieldState }) => (
          <FieldSet data-invalid={fieldState.invalid}>
            <FieldLegend variant="label">
              Menu{" "}
              {event.menuSelection === "SINGLE"
                ? "(pilih satu)"
                : "(pilih minimal satu)"}
            </FieldLegend>

            {event.menuSelection === "SINGLE" ? (
              <RadioGroup
                name={field.name}
                value={field.value?.[0] ?? ""}
                onValueChange={(id) => {
                  field.onChange(id ? [id] : []);
                }}
                aria-invalid={fieldState.invalid}
                className="grid gap-3"
              >
                {event.menuItems.map((item) => {
                  const inputId = `ms-reg-menu-radio-${item.id}`;
                  return (
                    <FieldLabel key={item.id} htmlFor={inputId}>
                      <Field
                        orientation="horizontal"
                        data-invalid={fieldState.invalid}
                        className="items-start justify-between gap-4 rounded-md border border-[hsl(var(--border))] p-3"
                      >
                        <FieldContent>
                          <FieldTitle>{item.name}</FieldTitle>
                          <FieldDescription>
                            {formatIdr(item.price)}
                            {item.voucherEligible
                              ? " · boleh voucher"
                              : null}
                          </FieldDescription>
                        </FieldContent>
                        <RadioGroupItem
                          id={inputId}
                          value={item.id}
                          aria-invalid={fieldState.invalid}
                        />
                      </Field>
                    </FieldLabel>
                  );
                })}
              </RadioGroup>
            ) : (
              <FieldGroup data-slot="checkbox-group" className="grid gap-3">
                {event.menuItems.map((item) => {
                  const inputId = `ms-reg-menu-cb-${item.id}`;
                  const current = field.value ?? [];
                  return (
                    <Field
                      key={item.id}
                      orientation="horizontal"
                      data-invalid={fieldState.invalid}
                      className="items-start justify-between gap-4 rounded-md border border-[hsl(var(--border))] p-3"
                    >
                      <Checkbox
                        id={inputId}
                        name={field.name}
                        aria-invalid={fieldState.invalid}
                        checked={current.includes(item.id)}
                        onCheckedChange={(checked) => {
                          if (checked === true) {
                            field.onChange([
                              ...new Set([...current, item.id]),
                            ]);
                          } else {
                            field.onChange(
                              current.filter((id) => id !== item.id),
                            );
                          }
                        }}
                      />
                      <FieldLabel htmlFor={inputId} className="font-normal">
                        <FieldContent>
                          <FieldTitle>{item.name}</FieldTitle>
                          <FieldDescription>
                            {formatIdr(item.price)}
                            {item.voucherEligible
                              ? " · boleh voucher"
                              : null}
                          </FieldDescription>
                        </FieldContent>
                      </FieldLabel>
                    </Field>
                  );
                })}
              </FieldGroup>
            )}

            {fieldState.invalid ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </FieldSet>
        )}
      />
    </section>
  );
}
