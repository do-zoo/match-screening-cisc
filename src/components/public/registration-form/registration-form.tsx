"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { submitRegistration } from "@/lib/actions/submit-registration";
import type { ActionResult } from "@/lib/forms/action-result";
import {
  createSubmitRegistrationFormSchema,
  isMemberCardPhotoMissingWhenRequired,
  isMemberNumberMissingWhenMember,
  MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
  MEMBER_CARD_REQUIRED_WHEN_NUMBER_MESSAGE,
  MEMBER_NUMBER_REQUIRED_WHEN_MEMBER_MESSAGE,
  type SubmitRegistrationInput,
} from "@/lib/forms/submit-registration-schema";

import { MenuSelectionSection } from "./menu-selection-section";
import { PartnerTicketSection } from "./partner-ticket-section";
import { PaymentSection } from "./payment-section";
import { PurchaserInfoSection } from "./purchaser-info-section";
import type { RegistrationFormProps } from "./types";
import {
  buildRegistrationSteps,
  getTriggerFieldsForStep,
  type RegistrationStepId,
  registrationStepTitle,
  resolveActiveStepAfterStepsChange,
} from "./registration-steps";
import { RegistrationProgressStepper } from "./registration-progress-stepper";
import { usePartnerGate } from "./use-partner-gate";
import { usePricingPreview } from "./use-pricing-preview";

function serverFieldErrorsToStepHint(
  fe: Record<string, string>
): RegistrationStepId {
  if (fe.transferProof) return "payment";
  if (fe.selectedMenuItemIds) return "menu";
  if (fe.partnerName || fe.partnerWhatsapp || fe.partnerMemberNumber) {
    return "partner";
  }
  if (fe.memberCardPhoto || fe.claimedMemberNumber || fe.purchaserIsMember) {
    return "purchaser";
  }
  if (fe.contactName || fe.contactWhatsapp) return "purchaser";
  return "payment";
}

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
      purchaserIsMember: false,
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
    event.slug,
    claimedMemberTrim
  );

  const steps = useMemo(
    () => buildRegistrationSteps(event.menuMode, showPartnerSection),
    [event.menuMode, showPartnerSection]
  );

  const [userStepId, setUserStepId] = useState<RegistrationStepId>("purchaser");
  const activeStepId = useMemo(
    () => resolveActiveStepAfterStepsChange(userStepId, steps),
    [userStepId, steps]
  );

  const activeIndex = Math.max(0, steps.indexOf(activeStepId));
  const isLastStep = activeIndex === steps.length - 1;
  const qtyPartner = watched.qtyPartner ?? 0;
  const purchaserIsMember = Boolean(watched.purchaserIsMember);

  const directoryVerified = useMemo(
    () =>
      purchaserIsMember &&
      claimedMemberTrim.length > 0 &&
      effectivePartnerGate.status === "ready" &&
      effectivePartnerGate.found &&
      effectivePartnerGate.seatForEvent === "available" &&
      effectivePartnerGate.forTrim === claimedMemberTrim,
    [purchaserIsMember, claimedMemberTrim, effectivePartnerGate]
  );

  const pricingPreview = usePricingPreview(
    event,
    selectedMenuIds,
    watched.claimedMemberNumber,
    watched.qtyPartner
  );

  const goNext = useCallback(async () => {
    const stepId = steps[activeIndex];
    if (!stepId) return;
    const fields = getTriggerFieldsForStep(stepId, qtyPartner, {
      purchaserIsMember,
      directoryVerified,
    });
    const ok =
      fields.length === 0 ||
      (await form.trigger(fields as (keyof SubmitRegistrationInput)[], {
        shouldFocus: true,
      }));
    if (!ok) return;
    /** Subset `trigger` tidak selalu menegakkan `superRefine` kombinasi member + nomor. */
    if (
      stepId === "purchaser" &&
      isMemberNumberMissingWhenMember(form.getValues())
    ) {
      form.setError("claimedMemberNumber", {
        type: "custom",
        message: MEMBER_NUMBER_REQUIRED_WHEN_MEMBER_MESSAGE,
      });
      void form.setFocus("claimedMemberNumber");
      return;
    }
    /** Zod tidak mengetahui hasil direktori; jangan lolos tanpa verified jika ada nomor diklaim. */
    if (
      stepId === "purchaser" &&
      purchaserIsMember &&
      claimedMemberTrim.length > 0 &&
      !directoryVerified
    ) {
      if (effectivePartnerGate.status === "checking") return;
      if (form.getFieldState("claimedMemberNumber", form.formState).error) {
        void form.setFocus("claimedMemberNumber");
        return;
      }
      form.setError("claimedMemberNumber", {
        type: "custom",
        message:
          "Tunggu hingga nomor dikenali atau perbaiki nomor member Anda sebelum melanjutkan.",
      });
      void form.setFocus("claimedMemberNumber");
      return;
    }
    /** Subset `trigger` tidak selalu membawa error superRefine untuk file kondisional — selaraskan dengan skema Zod. */
    if (
      stepId === "purchaser" &&
      isMemberCardPhotoMissingWhenRequired(form.getValues())
    ) {
      form.setError("memberCardPhoto", {
        type: "custom",
        message: MEMBER_CARD_REQUIRED_WHEN_NUMBER_MESSAGE,
      });
      void form.setFocus("memberCardPhoto");
      return;
    }
    const next = steps[activeIndex + 1];
    if (next) setUserStepId(next);
  }, [
    steps,
    activeIndex,
    form,
    qtyPartner,
    purchaserIsMember,
    directoryVerified,
    effectivePartnerGate.status,
    claimedMemberTrim,
  ]);

  const goBack = useCallback(() => {
    const prev = steps[activeIndex - 1];
    if (prev) setUserStepId(prev);
  }, [steps, activeIndex]);

  const stepProgressMeta = useMemo(
    () =>
      steps.map((id) => ({
        id,
        title: registrationStepTitle(id),
      })),
    [steps]
  );

  const navigateToPastStepIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= activeIndex) return;
      const id = steps[index];
      if (id) setUserStepId(id);
    },
    [steps, activeIndex]
  );

  async function submitForm(values: SubmitRegistrationInput) {
    if (!event.registrationOpen) return;

    const claimedTrim = String(values.claimedMemberNumber ?? "").trim();
    if (
      values.purchaserIsMember &&
      claimedTrim.length > 0 &&
      effectivePartnerGate.status === "ready" &&
      effectivePartnerGate.found &&
      effectivePartnerGate.seatForEvent === "taken" &&
      effectivePartnerGate.forTrim === claimedTrim
    ) {
      form.setError("claimedMemberNumber", {
        message: MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
      });
      void form.setFocus("claimedMemberNumber");
      setUserStepId(resolveActiveStepAfterStepsChange("purchaser", steps));
      return;
    }

    const fd = new FormData();
    fd.set("slug", values.slug);
    fd.set("purchaserIsMember", values.purchaserIsMember ? "1" : "0");
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
      router.push(
        `/events/${event.slug}/register/${result.data.registrationId}`
      );
      return;
    }

    form.clearErrors("root.server");
    form.clearErrors([
      "slug",
      "purchaserIsMember",
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

    const hint = serverFieldErrorsToStepHint(fe);
    setUserStepId(resolveActiveStepAfterStepsChange(hint, steps));
    void form.trigger(undefined, { shouldFocus: true });
  }

  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      encType="multipart/form-data"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isLastStep) return;
        void form.handleSubmit(submitForm)(e);
      }}
    >
      <input type="hidden" name="slug" value={event.slug} readOnly />
      {form.formState.errors.slug ? (
        <FieldError errors={[form.formState.errors.slug]} />
      ) : null}

      {event.registrationClosedMessage ? (
        <Alert>
          <AlertTitle>Pendaftaran ditutup</AlertTitle>
          <AlertDescription>{event.registrationClosedMessage}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset
        disabled={!event.registrationOpen}
        className="min-w-0 space-y-5 border-0 p-0"
      >
        <legend className="sr-only">Formulir pendaftaran berjenjang</legend>

        <div
          className="rounded-xl border border-border bg-card/80 px-5 py-5 shadow-sm ring-1 ring-border/80 backdrop-blur-[2px] space-y-4"
          aria-live="polite"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="sr-only">
                Sekarang mengisi langkah berjudul{" "}
                {registrationStepTitle(activeStepId)}.
              </span>
            </div>
            <RegistrationProgressStepper
              steps={stepProgressMeta}
              activeIndex={activeIndex}
              allowNavigateToPastSteps
              onNavigateToStepIndex={navigateToPastStepIndex}
            />
            <h2
              id="ms-registration-step-heading"
              className="scroll-mt-24 text-xl font-semibold tracking-tight text-foreground"
            >
              {registrationStepTitle(activeStepId)}
            </h2>
          </div>
          {steps.map((stepId) => {
            const active = stepId === activeStepId;
            return (
              <div
                key={stepId}
                id={`ms-reg-step-${stepId}`}
                hidden={!active}
                className="min-w-0"
                {...(active
                  ? { "aria-labelledby": "ms-registration-step-heading" }
                  : {})}
              >
                {stepId === "purchaser" ? (
                  <PurchaserInfoSection
                    control={form.control}
                    setValue={form.setValue}
                    clearErrors={form.clearErrors}
                    claimedMemberTrim={claimedMemberTrim}
                    effectivePartnerGate={effectivePartnerGate}
                  />
                ) : null}
                {stepId === "partner" ? (
                  <PartnerTicketSection
                    control={form.control}
                    showPartnerSection={showPartnerSection}
                    qtyPartner={watched.qtyPartner}
                  />
                ) : null}
                {stepId === "menu" ? (
                  <MenuSelectionSection control={form.control} event={event} />
                ) : null}
                {stepId === "payment" ? (
                  <PaymentSection
                    control={form.control}
                    event={event}
                    pricingPreview={pricingPreview}
                  />
                ) : null}
              </div>
            );
          })}

          {form.formState.errors.root?.server ? (
            <FieldError errors={[form.formState.errors.root.server]} />
          ) : null}

          <div className="grid grid-cols-1 gap-3 border-t border-border/80 pt-5 sm:grid-cols-2">
            {!isLastStep ? (
              <Button
                type="button"
                size="lg"
                className="order-1 min-h-12 w-full sm:order-2 sm:justify-center"
                disabled={!event.registrationOpen}
                onClick={() => void goNext()}
              >
                Lanjut
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                className="order-1 min-h-12 w-full sm:order-2 sm:justify-center"
                disabled={
                  !event.registrationOpen || form.formState.isSubmitting
                }
              >
                {form.formState.isSubmitting
                  ? "Mengirim…"
                  : "Kirim pendaftaran"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="order-2 min-h-12 w-full sm:order-1 sm:justify-center"
              disabled={!event.registrationOpen || activeIndex === 0}
              onClick={goBack}
            >
              Kembali
            </Button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

export default RegistrationForm;
