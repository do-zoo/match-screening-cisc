"use client";

import { useRouter } from "next/navigation";
import { Controller, FormProvider, useFieldArray, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submitRegistration } from "@/lib/actions/submit-registration";
import { toastActionErr, toastCudSuccess } from "@/lib/client/cud-notify";
import {
  submitRegistrationSchema,
  type SubmitRegistrationInput,
} from "@/lib/forms/submit-registration-schema";
import { formatIdr } from "@/lib/utils/format-idr";

import { CategoryPicker } from "./category-picker";
import { HolderCard } from "./holder-card";
import { usePricingPreview } from "./use-pricing-preview";
import type { RegistrationFormProps } from "./types";

export function RegistrationForm({ event }: RegistrationFormProps) {
  const router = useRouter();

  const form = useForm<SubmitRegistrationInput>({
    resolver: zodResolver(submitRegistrationSchema as never) as Resolver<SubmitRegistrationInput>,
    defaultValues: {
      ticketCategoryId: event.ticketCategories?.[0]?.id ?? "",
      ticketQty: 1,
      holders: [{ holderName: "", claimedMemberNumber: "", mandatoryMenuItemId: "" }],
      contactWhatsapp: "",
    },
  });

  const { fields, replace } = useFieldArray({ control: form.control, name: "holders" });

  const selectedCategoryId = form.watch("ticketCategoryId");
  const ticketQty = form.watch("ticketQty");
  const holders = form.watch("holders");

  const selectedCategory = event.ticketCategories?.find((c) => c.id === selectedCategoryId);
  const pricing = usePricingPreview({ category: selectedCategory, holders });

  function handleQtyChange(qty: number) {
    form.setValue("ticketQty", qty);
    const current = form.getValues("holders");
    const next = Array.from(
      { length: qty },
      (_, i) => current[i] ?? { holderName: "", claimedMemberNumber: "" },
    );
    replace(next);
  }

  async function onSubmit(values: SubmitRegistrationInput) {
    const formData = new FormData();
    formData.append("ticketCategoryId", values.ticketCategoryId);
    formData.append("ticketQty", String(values.ticketQty));
    formData.append("holders", JSON.stringify(values.holders));
    formData.append("contactWhatsapp", values.contactWhatsapp);
    if (values.transferProof) formData.append("transferProof", values.transferProof);

    const result = await submitRegistration(null, formData);
    if (result.ok) {
      toastCudSuccess("create", "Pendaftaran berhasil dikirim.");
      router.push(`/events/${event.slug}/register/${result.data.registrationId}`);
      return;
    }

    toastActionErr(result);

    if (result.rootError) {
      form.setError("root", { message: result.rootError });
    }
    if (result.fieldErrors) {
      for (const [key, msg] of Object.entries(result.fieldErrors)) {
        form.setError(key as keyof SubmitRegistrationInput, { message: msg });
      }
    }
  }

  return (
    <FormProvider {...form}>
      <form
        className="mx-auto flex w-full max-w-2xl flex-col gap-6 md:p-6"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <fieldset
          disabled={!event.registrationOpen}
          className="min-w-0 space-y-6 border-0 p-0"
        >
          <legend className="sr-only">Formulir pendaftaran acara</legend>

          {/* Category + qty picker */}
          <div className="rounded-xl border border-border bg-card/80 px-5 py-5 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Pilih Tiket</h2>
            {event.ticketCategories && event.ticketCategories.length > 0 ? (
              <CategoryPicker
                categories={event.ticketCategories}
                selectedId={selectedCategoryId}
                onSelect={(id) => form.setValue("ticketCategoryId", id)}
                qty={ticketQty}
                onQtyChange={handleQtyChange}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Tidak ada kategori tiket yang tersedia.
              </p>
            )}
          </div>

          {/* Holder cards */}
          <div className="rounded-xl border border-border bg-card/80 px-5 py-5 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Data Peserta</h2>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <HolderCard
                  key={field.id}
                  index={index}
                  isPrimary={index === 0}
                  menuItems={event.mandatoryMenuItems}
                  menuRequired={event.menuRequired ?? false}
                />
              ))}
            </div>
          </div>

          {/* Contact & payment */}
          <div className="rounded-xl border border-border bg-card/80 px-5 py-5 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Kontak &amp; Pembayaran</h2>

            <Controller
              control={form.control}
              name="contactWhatsapp"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="ms-registration-whatsapp">Nomor WhatsApp</FieldLabel>
                  <Input
                    id="ms-registration-whatsapp"
                    type="tel"
                    placeholder="+62 812 xxxx xxxx"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <div className="text-sm leading-relaxed text-foreground/85">
              Transfer ke:{" "}
              <span className="font-medium text-foreground">
                {event.bankAccount.bankName}
              </span>{" "}
              — {event.bankAccount.accountName}{" "}
              <span className="font-mono">{event.bankAccount.accountNumber}</span>
            </div>

            <Controller
              control={form.control}
              name="transferProof"
              render={({ field: { ref, name, onBlur, onChange }, fieldState }) => (
                <FileField
                  ref={ref}
                  id="ms-registration-transfer-proof"
                  label="Bukti transfer"
                  description="Unggah screenshot atau foto bukti pembayaran (JPG, PNG, WebP). Pastikan nominal dan nama penerima terbaca."
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
          </div>

          {/* Pricing summary */}
          {pricing && (
            <div className="rounded-xl border border-border bg-muted/30 px-5 py-4 space-y-2">
              <p className="font-medium text-sm">Estimasi Total</p>
              {pricing.lines.map((l) => (
                <div key={l.index} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tiket {l.index + 1} ({l.isMember ? "Member" : "Reguler"})
                  </span>
                  <span className="font-mono tabular-nums">{formatIdr(l.ticketPrice)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span className="font-mono tabular-nums">{formatIdr(pricing.grandTotal)}</span>
              </div>
            </div>
          )}

          {form.formState.errors.root && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.root.message}
            </p>
          )}

          <Button
            type="submit"
            disabled={!event.registrationOpen || form.formState.isSubmitting}
            className="w-full min-h-12"
          >
            {form.formState.isSubmitting ? "Mengirim…" : "Kirim pendaftaran"}
          </Button>
        </fieldset>
      </form>
    </FormProvider>
  );
}

export default RegistrationForm;
