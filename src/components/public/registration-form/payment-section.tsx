"use client";

import { Controller, type Control } from "react-hook-form";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import { PriceBreakdown } from "@/components/public/price-breakdown";
import { FileField } from "@/components/ui/file-field";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";
import type { SubmitPricingResult } from "@/lib/pricing/compute-submit-total";

type Pricing = SubmitPricingResult | null;

type Props = {
  control: Control<SubmitRegistrationInput>;
  event: SerializedEventForRegistration;
  pricingPreview: Pricing;
};

export function PaymentSection({
  control,
  event,
  pricingPreview,
}: Props) {
  return (
    <section className="grid gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="font-medium">Pembayaran</div>
      </div>

      <div className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
        Transfer ke:{" "}
        <span className="font-medium text-foreground">
          {event.bankAccount.bankName}
        </span>{" "}
        — {event.bankAccount.accountName}{" "}
        <span className="font-mono">{event.bankAccount.accountNumber}</span>
      </div>

      <Controller
        control={control}
        name="transferProof"
        render={({ field: { ref, name, onBlur, onChange }, fieldState }) => (
          <FileField
            ref={ref}
            id="ms-registration-transfer-proof"
            label="Bukti transfer"
            description={
              <>
                Unggah screenshot atau foto bukti pembayaran (JPG, PNG, WebP).
                Pastikan nominal dan nama penerima terbaca.
              </>
            }
            name={name}
            onBlur={onBlur}
            onChange={onChange}
            invalid={fieldState.invalid}
            errors={fieldState.error ? [fieldState.error] : undefined}
            pickPrompt="Ketuk untuk memilih bukti"
            replacePrompt="Ganti bukti"
          />
        )}
      />

      <PriceBreakdown event={event} pricing={pricingPreview} />
    </section>
  );
}
