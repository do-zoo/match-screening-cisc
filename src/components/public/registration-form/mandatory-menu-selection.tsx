"use client";

import { Check, Utensils } from "lucide-react";
import Image from "next/image";
import { Controller, type Control } from "react-hook-form";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";
import { formatIdr } from "@/lib/utils/format-idr";
import { cn } from "@/lib/utils";

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
    <Controller
      control={control}
      name={fieldName}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel>{label}</FieldLabel>
          <FieldDescription>
            Pilih tepat satu menu. Harga berikut sudah termasuk dalam total
            pembayaran sesuai rincian di langkah berikutnya.
          </FieldDescription>
          <RadioGroup
            value={field.value ?? ""}
            onValueChange={field.onChange}
            className="mt-4 space-y-3"
          >
            {event.mandatoryMenuItems.map((item) => {
              const selected = field.value === item.id;
              const inputId = `menu-${fieldName}-${item.id}`;
              return (
                <div key={item.id} className="min-w-0">
                  <label
                    className={cn(
                      "flex cursor-pointer gap-3.5 rounded-xl border p-3.5 transition-colors sm:gap-4 sm:p-4",
                      "focus-within:ring-2 focus-within:ring-ring/60 focus-within:ring-offset-2 focus-within:ring-offset-background",
                      selected
                        ? "border-primary/55 bg-muted/15"
                        : "border-border bg-card hover:bg-accent/25",
                      fieldState.invalid &&
                        !selected &&
                        "border-destructive/45 hover:border-destructive/55",
                    )}
                  >
                    <span className="sr-only">
                      <RadioGroupItem
                        value={item.id}
                        id={inputId}
                        aria-describedby={
                          item.description
                            ? `${inputId}-price ${inputId}-desc`
                            : `${inputId}-price`
                        }
                      />
                    </span>
                    {item.imageBlobUrl ? (
                      <span className="bg-muted relative block h-18 w-22 shrink-0 overflow-hidden rounded-lg border border-border/60 shadow-inner sm:h-24 sm:w-28">
                        <Image
                          src={item.imageBlobUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 639px) 88px, 112px"
                        />
                      </span>
                    ) : (
                      <span
                        className="bg-muted text-muted-foreground flex h-18 w-22 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/80 sm:h-24 sm:w-28"
                        aria-hidden
                      >
                        <Utensils className="size-7 opacity-60" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-foreground block text-base font-semibold leading-snug">
                          {item.name}
                        </span>
                        <span
                          id={`${inputId}-price`}
                          className="text-muted-foreground font-mono text-sm tabular-nums tracking-tight"
                        >
                          {formatIdr(item.price)}
                        </span>
                      </span>
                      {item.description ? (
                        <span
                          id={`${inputId}-desc`}
                          className="text-muted-foreground block text-sm leading-relaxed line-clamp-4"
                        >
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "flex shrink-0 items-start justify-end self-start",
                        selected ? "size-6" : "size-0 overflow-hidden",
                      )}
                      aria-hidden
                    >
                      {selected ? (
                        <span className="text-primary-foreground flex size-6 items-center justify-center rounded-full bg-primary shadow-sm">
                          <Check className="size-4" strokeWidth={2.5} />
                        </span>
                      ) : null}
                    </span>
                  </label>
                </div>
              );
            })}
          </RadioGroup>
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}
