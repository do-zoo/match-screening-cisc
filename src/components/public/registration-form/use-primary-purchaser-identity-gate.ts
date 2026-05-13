"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { primaryMemberSeatTakenForActiveEventSlug } from "@/lib/actions/check-member-seat-for-event";
import { lookupManagementCodeForRegistration } from "@/lib/actions/lookup-management-code-for-registration";
import { lookupMemberPartnerEligibility } from "@/lib/actions/lookup-member-partner-eligibility";
import {
  MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
  PRIMARY_PURCHASER_IDENTITY_NOT_RECOGNIZED_MESSAGE,
  type SubmitRegistrationInput,
} from "@/lib/forms/submit-registration-schema";
import { resolvePrimaryPurchaserIdentity } from "@/lib/registrations/resolve-primary-purchaser-identity";

import type { ManagementCodeGateState, PartnerGateState } from "./types";

const LOOKUP_DEBOUNCE_MS = 300;

export function usePrimaryPurchaserIdentityGate(
  form: UseFormReturn<SubmitRegistrationInput>,
  eventSlug: string,
  combinedTrim: string,
) {
  const [partnerGate, setPartnerGate] = useState<PartnerGateState>({
    status: "empty",
  });
  const [mgmtGate, setMgmtGate] = useState<ManagementCodeGateState>({
    status: "empty",
  });

  const resetPartnerFields = useCallback(() => {
    form.setValue("qtyPartner", 0, { shouldValidate: true });
    form.setValue("partnerIsMember", false);
    form.setValue("partnerName", "");
    form.setValue("partnerWhatsapp", "");
    form.setValue("partnerMemberNumber", "");
    form.setValue("partnerMemberCardPhoto", undefined, {
      shouldValidate: false,
    });
    form.clearErrors([
      "qtyPartner",
      "partnerIsMember",
      "partnerName",
      "partnerWhatsapp",
      "partnerMemberNumber",
      "partnerMemberCardPhoto",
    ]);
  }, [form]);

  const claimedMemberTrim = String(
    useWatch({ control: form.control, name: "claimedMemberNumber" }) ?? "",
  ).trim();
  const managementCodeTrim = String(
    useWatch({ control: form.control, name: "managementPublicCode" }) ?? "",
  ).trim();

  useEffect(() => {
    if (combinedTrim.length === 0) {
      form.setValue("memberCardPhoto", undefined, { shouldValidate: false });
      form.clearErrors("memberCardPhoto");
      form.clearErrors("claimedMemberNumber");
      form.clearErrors("managementPublicCode");
    }
  }, [combinedTrim, form]);

  useEffect(() => {
    if (combinedTrim.length === 0) {
      startTransition(() => {
        setPartnerGate({ status: "empty" });
        setMgmtGate({ status: "empty" });
      });
      resetPartnerFields();
      form.clearErrors("claimedMemberNumber");
      form.clearErrors("managementPublicCode");
      return;
    }

    let discarded = false;
    const inputForLookup = combinedTrim;
    const timeoutId = window.setTimeout(() => {
      form.clearErrors("claimedMemberNumber");
      form.clearErrors("managementPublicCode");
      startTransition(() => {
        setPartnerGate({ status: "checking", forTrim: inputForLookup });
        setMgmtGate({ status: "checking", forTrim: inputForLookup });
      });

      void resolvePrimaryPurchaserIdentity(inputForLookup, {
        lookupMember: lookupMemberPartnerEligibility,
        lookupManagement: lookupManagementCodeForRegistration,
      }).then((res) => {
        if (discarded) return;

        if (res.branch === "empty") {
          startTransition(() => {
            setPartnerGate({ status: "empty" });
            setMgmtGate({ status: "empty" });
          });
          return;
        }

        if (res.branch === "member") {
          startTransition(() => {
            setMgmtGate({ status: "empty" });
          });
          const canon = res.canonicalMemberNumber;
          form.setValue("claimedMemberNumber", canon, { shouldValidate: true });
          form.setValue("managementPublicCode", "", { shouldValidate: true });

          void primaryMemberSeatTakenForActiveEventSlug(eventSlug, canon).then(
            (seatTaken) => {
              if (discarded) return;

              if (seatTaken) {
                form.setError("claimedMemberNumber", {
                  message: MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
                });
                form.setValue("memberCardPhoto", undefined, {
                  shouldValidate: false,
                });
                form.clearErrors("memberCardPhoto");
                startTransition(() => {
                  setPartnerGate({
                    status: "ready",
                    forTrim: canon,
                    found: true,
                    isManagementMember: res.isManagementMember,
                    seatForEvent: "taken",
                  });
                });
                resetPartnerFields();
                return;
              }

              form.clearErrors("claimedMemberNumber");
              if (form.getValues("purchaserIsMember")) {
                form.setValue("contactName", res.fullName.trim(), {
                  shouldValidate: true,
                });
                const w = res.whatsapp?.trim();
                if (w) {
                  form.setValue("contactWhatsapp", w, { shouldValidate: true });
                }
              }

              startTransition(() => {
                setPartnerGate({
                  status: "ready",
                  forTrim: canon,
                  found: true,
                  isManagementMember: res.isManagementMember,
                  seatForEvent: "available",
                });
              });
              if (!res.isManagementMember) resetPartnerFields();
            },
          );
          return;
        }

        if (res.branch === "management") {
          startTransition(() => {
            setPartnerGate({ status: "empty" });
          });
          form.setValue("claimedMemberNumber", undefined, {
            shouldValidate: true,
          });
          form.setValue("managementPublicCode", res.normalizedCode, {
            shouldValidate: true,
          });
          form.clearErrors(["claimedMemberNumber", "managementPublicCode"]);
          if (form.getValues("purchaserIsMember")) {
            form.setValue("contactName", res.fullName.trim(), {
              shouldValidate: true,
            });
          }
          form.setValue("memberCardPhoto", undefined, {
            shouldValidate: false,
          });
          form.clearErrors("memberCardPhoto");
          startTransition(() => {
            setMgmtGate({
              status: "ready",
              forTrim: res.normalizedCode,
              found: true,
              fullName: res.fullName,
            });
          });
          return;
        }

        form.setValue("managementPublicCode", "", { shouldValidate: true });
        form.setValue("claimedMemberNumber", res.inputTrim, {
          shouldValidate: true,
        });
        form.setError("claimedMemberNumber", {
          message: PRIMARY_PURCHASER_IDENTITY_NOT_RECOGNIZED_MESSAGE,
        });
        form.setValue("memberCardPhoto", undefined, { shouldValidate: false });
        form.clearErrors("memberCardPhoto");
        resetPartnerFields();
        startTransition(() => {
          setMgmtGate({ status: "empty" });
          setPartnerGate({
            status: "ready",
            forTrim: res.inputTrim,
            found: false,
            isManagementMember: false,
          });
        });
      });
    }, LOOKUP_DEBOUNCE_MS);

    return () => {
      discarded = true;
      window.clearTimeout(timeoutId);
    };
  }, [combinedTrim, eventSlug, form, resetPartnerFields]);

  const effectivePartnerGate: PartnerGateState = useMemo(() => {
    if (claimedMemberTrim.length === 0) {
      return { status: "empty" };
    }
    if (partnerGate.status === "empty") {
      return { status: "checking", forTrim: claimedMemberTrim };
    }
    if (
      partnerGate.status === "checking" &&
      partnerGate.forTrim !== claimedMemberTrim
    ) {
      return { status: "checking", forTrim: claimedMemberTrim };
    }
    if (
      partnerGate.status === "ready" &&
      partnerGate.forTrim !== claimedMemberTrim
    ) {
      return { status: "checking", forTrim: claimedMemberTrim };
    }
    return partnerGate;
  }, [claimedMemberTrim, partnerGate]);

  const effectiveManagementCodeGate: ManagementCodeGateState = useMemo(() => {
    const t = managementCodeTrim.trim();
    if (claimedMemberTrim.length > 0 || !t) return { status: "empty" };
    if (mgmtGate.status === "empty") return { status: "checking", forTrim: t };
    if (mgmtGate.status === "checking" && mgmtGate.forTrim !== t) {
      return { status: "checking", forTrim: t };
    }
    if (mgmtGate.status === "ready" && mgmtGate.forTrim !== t) {
      return { status: "checking", forTrim: t };
    }
    return mgmtGate;
  }, [claimedMemberTrim, mgmtGate, managementCodeTrim]);

  const directoryVerifiedByCode =
    effectiveManagementCodeGate.status === "ready" &&
    effectiveManagementCodeGate.found === true;

  const showPartnerByNumber =
    effectivePartnerGate.status === "ready" &&
    effectivePartnerGate.found &&
    effectivePartnerGate.seatForEvent === "available" &&
    effectivePartnerGate.isManagementMember;

  return {
    effectivePartnerGate,
    effectiveManagementCodeGate,
    directoryVerifiedByCode,
    showPartnerByNumber,
  };
}

