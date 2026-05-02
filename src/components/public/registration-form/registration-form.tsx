"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { submitRegistration } from "@/lib/actions/submit-registration";
import type { ActionResult } from "@/lib/forms/action-result";
import {
  createSubmitRegistrationFormSchema,
  isMemberCardPhotoMissingWhenRequired,
  isMemberNumberMissingWhenMember,
  isPartnerMemberCardPhotoMissingWhenRequired,
  isPartnerMemberNumberMissingWhenPartnerMember,
  MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
  MEMBER_CARD_REQUIRED_WHEN_NUMBER_MESSAGE,
  MEMBER_IDENTITY_NUMBER_OR_CODE_MESSAGE,
  MEMBER_NUMBER_REQUIRED_WHEN_PARTNER_IS_MEMBER_MESSAGE,
  type SubmitRegistrationInput,
} from "@/lib/forms/submit-registration-schema";

import { MenuSelectionSection } from "./menu-selection-section";
import { PartnerTicketSection } from "./partner-ticket-section";
import { PaymentSection } from "./payment-section";
import { PurchaserInfoSection } from "./purchaser-info-section";
import { RegistrationProgressStepper } from "./registration-progress-stepper";
import {
  buildRegistrationSteps,
  getTriggerFieldsForStep,
  type RegistrationStepId,
  registrationStepTitle,
  resolveActiveStepAfterStepsChange,
} from "./registration-steps";
import type { RegistrationFormProps } from "./types";
import { useManagementCodeGate } from "./use-management-code-gate";
import { usePartnerGate } from "./use-partner-gate";
import { usePartnerMemberNumberValidation } from "./use-partner-member-number-validation";
import { usePricingPreview } from "./use-pricing-preview";

function serverFieldErrorsToStepHint(
  fe: Record<string, string>
): RegistrationStepId {
  if (fe.transferProof) return "payment";
  if (fe.selectedMenuItemIds) return "menu";
  if (
    fe.partnerMemberCardPhoto ||
    fe.partnerMemberNumber ||
    fe.partnerWhatsapp ||
    fe.partnerName ||
    fe.partnerIsMember
  ) {
    return "partner";
  }
  if (
    fe.memberCardPhoto ||
    fe.claimedMemberNumber ||
    fe.managementPublicCode ||
    fe.purchaserIsMember
  ) {
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
      managementPublicCode: "",
      qtyPartner: 0,
      partnerIsMember: false,
      partnerName: "",
      partnerWhatsapp: "",
      partnerMemberNumber: "",
      partnerMemberCardPhoto: undefined,
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
  const managementCodeTrim = String(watched.managementPublicCode ?? "").trim();

  const { effectivePartnerGate, showPartnerSection: showPartnerByNumber } =
    usePartnerGate(form, event.slug, claimedMemberTrim, managementCodeTrim);

  const { directoryVerifiedByCode, effectiveManagementCodeGate } =
    useManagementCodeGate(form, managementCodeTrim, claimedMemberTrim);

  const showPartnerSection = showPartnerByNumber || directoryVerifiedByCode;

  const { effectivePartnerMemberGate } = usePartnerMemberNumberValidation(
    form,
    event.slug,
    showPartnerSection,
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
  const partnerMemberTrim = String(watched.partnerMemberNumber ?? "").trim();
  const partnerIsMemberWatch = Boolean(watched.partnerIsMember);

  const partnerDirectoryVerified = useMemo(
    () =>
      qtyPartner === 1 &&
      partnerIsMemberWatch &&
      partnerMemberTrim.length > 0 &&
      effectivePartnerMemberGate.status === "ready" &&
      effectivePartnerMemberGate.found &&
      effectivePartnerMemberGate.seatForEvent === "available" &&
      effectivePartnerMemberGate.forTrim === partnerMemberTrim,
    [
      effectivePartnerMemberGate,
      partnerMemberTrim,
      partnerIsMemberWatch,
      qtyPartner,
    ],
  );

  const directoryVerified = useMemo(() => {
    const numberPath =
      purchaserIsMember &&
      claimedMemberTrim.length > 0 &&
      effectivePartnerGate.status === "ready" &&
      effectivePartnerGate.found &&
      effectivePartnerGate.seatForEvent === "available" &&
      effectivePartnerGate.forTrim === claimedMemberTrim;
    return numberPath || directoryVerifiedByCode;
  }, [
    purchaserIsMember,
    claimedMemberTrim,
    effectivePartnerGate,
    directoryVerifiedByCode,
  ]);

  const pricingPreview = usePricingPreview(
    event,
    selectedMenuIds,
    watched.claimedMemberNumber,
    watched.qtyPartner,
    watched.partnerIsMember,
    watched.managementPublicCode,
  );

  const goNext = useCallback(async () => {
    const stepId = steps[activeIndex];
    if (!stepId) return;
    const fields = getTriggerFieldsForStep(stepId, qtyPartner, {
      purchaserIsMember,
      directoryVerified,
      partnerIsMember: partnerIsMemberWatch,
      partnerDirectoryVerified,
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
        message: MEMBER_IDENTITY_NUMBER_OR_CODE_MESSAGE,
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
    if (
      stepId === "purchaser" &&
      purchaserIsMember &&
      claimedMemberTrim.length === 0 &&
      managementCodeTrim.length > 0 &&
      !directoryVerifiedByCode
    ) {
      if (effectiveManagementCodeGate.status === "checking") return;
      if (form.getFieldState("managementPublicCode", form.formState).error) {
        void form.setFocus("managementPublicCode");
        return;
      }
      form.setError("managementPublicCode", {
        type: "custom",
        message:
          "Tunggu hingga kode dikenali atau perbaiki kode pengurus sebelum melanjutkan.",
      });
      void form.setFocus("managementPublicCode");
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
    if (
      stepId === "partner" &&
      isPartnerMemberNumberMissingWhenPartnerMember(form.getValues())
    ) {
      form.setError("partnerMemberNumber", {
        type: "custom",
        message: MEMBER_NUMBER_REQUIRED_WHEN_PARTNER_IS_MEMBER_MESSAGE,
      });
      void form.setFocus("partnerMemberNumber");
      return;
    }
    if (
      stepId === "partner" &&
      qtyPartner === 1 &&
      partnerIsMemberWatch &&
      partnerMemberTrim.length > 0 &&
      !partnerDirectoryVerified
    ) {
      if (effectivePartnerMemberGate.status === "checking") return;
      if (
        form.getFieldState("partnerMemberNumber", form.formState).error
      ) {
        void form.setFocus("partnerMemberNumber");
        return;
      }
      form.setError("partnerMemberNumber", {
        type: "custom",
        message:
          "Tunggu hingga nomor dikenali atau perbaiki nomor member partner sebelum melanjutkan.",
      });
      void form.setFocus("partnerMemberNumber");
      return;
    }
    if (
      stepId === "partner" &&
      isPartnerMemberCardPhotoMissingWhenRequired(form.getValues())
    ) {
      form.setError("partnerMemberCardPhoto", {
        type: "custom",
        message: MEMBER_CARD_REQUIRED_WHEN_NUMBER_MESSAGE,
      });
      void form.setFocus("partnerMemberCardPhoto");
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
    managementCodeTrim,
    directoryVerifiedByCode,
    effectiveManagementCodeGate.status,
    partnerMemberTrim,
    partnerDirectoryVerified,
    partnerIsMemberWatch,
    effectivePartnerMemberGate,
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

    const partnerTrimSubmit = String(values.partnerMemberNumber ?? "").trim();
    if (
      values.qtyPartner === 1 &&
      values.partnerIsMember &&
      partnerTrimSubmit.length > 0 &&
      effectivePartnerMemberGate.status === "checking"
    ) {
      form.setError("partnerMemberNumber", {
        type: "custom",
        message:
          "Tunggu hingga validasi nomor member partner selesai, lalu coba lagi.",
      });
      void form.setFocus("partnerMemberNumber");
      setUserStepId(resolveActiveStepAfterStepsChange("partner", steps));
      return;
    }
    if (
      values.qtyPartner === 1 &&
      values.partnerIsMember &&
      partnerTrimSubmit.length > 0 &&
      effectivePartnerMemberGate.status === "ready" &&
      effectivePartnerMemberGate.found &&
      effectivePartnerMemberGate.seatForEvent === "taken" &&
      effectivePartnerMemberGate.forTrim === partnerTrimSubmit
    ) {
      form.setError("partnerMemberNumber", {
        message: MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
      });
      void form.setFocus("partnerMemberNumber");
      setUserStepId(resolveActiveStepAfterStepsChange("partner", steps));
      return;
    }

    const fd = new FormData();
    fd.set("slug", values.slug);
    fd.set("purchaserIsMember", values.purchaserIsMember ? "1" : "0");
    fd.set("contactName", values.contactName);
    fd.set("contactWhatsapp", values.contactWhatsapp);

    fd.set("claimedMemberNumber", values.claimedMemberNumber?.trim() ?? "");
    fd.set(
      "managementPublicCode",
      values.managementPublicCode?.trim() ?? "",
    );
    fd.set("qtyPartner", String(values.qtyPartner));

    fd.set("partnerIsMember", values.partnerIsMember ? "1" : "0");
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
    if (values.partnerMemberCardPhoto) {
      fd.set("partnerMemberCardPhoto", values.partnerMemberCardPhoto);
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
      "managementPublicCode",
      "transferProof",
      "memberCardPhoto",
      "partnerIsMember",
      "partnerName",
      "partnerWhatsapp",
      "partnerMemberNumber",
      "partnerMemberCardPhoto",
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
                    managementCodeTrim={managementCodeTrim}
                    effectivePartnerGate={effectivePartnerGate}
                    effectiveManagementCodeGate={effectiveManagementCodeGate}
                    directoryVerifiedByCode={directoryVerifiedByCode}
                  />
                ) : null}
                {stepId === "partner" ? (
                  <PartnerTicketSection
                    control={form.control}
                    setValue={form.setValue}
                    clearErrors={form.clearErrors}
                    showPartnerSection={showPartnerSection}
                    qtyPartner={watched.qtyPartner}
                    partnerIsMember={partnerIsMemberWatch}
                    partnerDirectoryVerified={partnerDirectoryVerified}
                    effectivePartnerMemberGate={effectivePartnerMemberGate}
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
