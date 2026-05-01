"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { submitRegistration } from "@/lib/actions/submit-registration";
import type { ActionResult } from "@/lib/forms/action-result";
import {
  createSubmitRegistrationFormSchema,
  type SubmitRegistrationInput,
} from "@/lib/forms/submit-registration-schema";

import { EventSummary } from "./event-summary";
import { MenuSelectionSection } from "./menu-selection-section";
import { PartnerTicketSection } from "./partner-ticket-section";
import { PaymentSection } from "./payment-section";
import { PurchaserInfoSection } from "./purchaser-info-section";
import type { RegistrationFormProps } from "./types";
import { usePartnerGate } from "./use-partner-gate";
import { usePricingPreview } from "./use-pricing-preview";

export function RegistrationForm({ event }: RegistrationFormProps) {
  const router = useRouter();

  const schema = useMemo(
    () => createSubmitRegistrationFormSchema(event),
    [event]
  );

  const form = useForm<SubmitRegistrationInput>({
    resolver: zodResolver(schema as never) as Resolver<SubmitRegistrationInput>,
    defaultValues: {
      slug: event.slug,
      contactName: "",
      contactWhatsapp: "",
      claimedMemberNumber: undefined,
      qtyPartner: 0,
      partnerName: "",
      partnerWhatsapp: "",
      partnerMemberNumber: "",
      selectedMenuItemIds:
        event.menuSelection === "SINGLE"
          ? event.menuItems[0]
            ? [event.menuItems[0].id]
            : []
          : [],
      transferProof: undefined,
      memberCardPhoto: undefined,
    },
    mode: "onChange",
  });

  const watched = useWatch({ control: form.control });
  const selectedMenuIds = useMemo(
    () => (watched.selectedMenuItemIds ?? []).filter(Boolean),
    [watched.selectedMenuItemIds]
  );
  const claimedMemberTrim = String(watched.claimedMemberNumber ?? "").trim();

  const { effectivePartnerGate, showPartnerSection } = usePartnerGate(
    form,
    claimedMemberTrim
  );

  const pricingPreview = usePricingPreview(
    event,
    selectedMenuIds,
    watched.claimedMemberNumber,
    watched.qtyPartner
  );

  async function submitForm(values: SubmitRegistrationInput) {
    const fd = new FormData();
    fd.set("slug", values.slug);
    fd.set("contactName", values.contactName);
    fd.set("contactWhatsapp", values.contactWhatsapp);

    fd.set("claimedMemberNumber", values.claimedMemberNumber?.trim() ?? "");
    fd.set("qtyPartner", String(values.qtyPartner));

    fd.set("partnerName", values.partnerName?.trim() ?? "");
    fd.set("partnerWhatsapp", values.partnerWhatsapp?.trim() ?? "");
    fd.set("partnerMemberNumber", values.partnerMemberNumber?.trim() ?? "");

    for (const id of values.selectedMenuItemIds ?? []) {
      if (id) fd.append("selectedMenuItemIds", id);
    }

    fd.set("transferProof", values.transferProof);
    if (values.memberCardPhoto) {
      fd.set("memberCardPhoto", values.memberCardPhoto);
    }

    const result: ActionResult<{ registrationId: string }> =
      await submitRegistration(null, fd);

    if (result.ok) {
      router.push(`/e/${event.slug}/r/${result.data.registrationId}`);
      return;
    }

    form.clearErrors("root.server");
    form.clearErrors([
      "slug",
      "claimedMemberNumber",
      "transferProof",
      "memberCardPhoto",
      "partnerName",
      "partnerWhatsapp",
      "partnerMemberNumber",
      "selectedMenuItemIds",
    ]);

    if (result.rootError) {
      form.setError("root.server", { message: result.rootError });
    }

    const fe = result.fieldErrors;
    if (!fe) return;

    for (const [key, msg] of Object.entries(fe)) {
      form.setError(key as keyof SubmitRegistrationInput, { message: msg });
    }
  }

  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      encType="multipart/form-data"
      onSubmit={form.handleSubmit(submitForm)}
    >
      <input type="hidden" name="slug" value={event.slug} readOnly />
      {form.formState.errors.slug ? (
        <FieldError errors={[form.formState.errors.slug]} />
      ) : null}

      <EventSummary event={event} />

      <PurchaserInfoSection
        control={form.control}
        claimedMemberTrim={claimedMemberTrim}
        effectivePartnerGate={effectivePartnerGate}
      />

      <PaymentSection
        control={form.control}
        event={event}
        pricingPreview={pricingPreview}
      />

      <MenuSelectionSection control={form.control} event={event} />

      <PartnerTicketSection
        control={form.control}
        showPartnerSection={showPartnerSection}
        qtyPartner={watched.qtyPartner}
      />

      {form.formState.errors.root?.server ? (
        <FieldError errors={[form.formState.errors.root.server]} />
      ) : null}

      <Button type="submit" size="lg" className="w-full">
        Kirim pendaftaran
      </Button>
    </form>
  );
}

export default RegistrationForm;
