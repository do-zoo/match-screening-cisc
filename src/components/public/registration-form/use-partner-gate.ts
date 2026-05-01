"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { lookupMemberPartnerEligibility } from "@/lib/actions/lookup-member-partner-eligibility";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

import type { PartnerGateState } from "./types";

const CLAIMED_MEMBER_NOT_IN_DIRECTORY =
  "Nomor member tidak dikenali atau tidak aktif di direktori kami.";

export function usePartnerGate(
  form: UseFormReturn<SubmitRegistrationInput>,
  claimedMemberTrim: string,
) {
  const [partnerGate, setPartnerGate] = useState<PartnerGateState>({
    status: "empty",
  });

  const resetPartnerFields = useCallback(() => {
    form.setValue("qtyPartner", 0, { shouldValidate: true });
    form.setValue("partnerName", "");
    form.setValue("partnerWhatsapp", "");
    form.setValue("partnerMemberNumber", "");
    form.clearErrors([
      "qtyPartner",
      "partnerName",
      "partnerWhatsapp",
      "partnerMemberNumber",
    ]);
  }, [form]);

  useEffect(() => {
    if (claimedMemberTrim.length === 0) {
      form.setValue("memberCardPhoto", undefined, { shouldValidate: false });
      form.clearErrors("memberCardPhoto");
      form.clearErrors("claimedMemberNumber");
    }
  }, [claimedMemberTrim, form]);

  useEffect(() => {
    if (claimedMemberTrim.length === 0) {
      form.clearErrors("claimedMemberNumber");
      resetPartnerFields();
      return;
    }

    let discarded = false;
    const trimmed = claimedMemberTrim;
    const timeoutId = window.setTimeout(() => {
      setPartnerGate({ status: "checking", forTrim: trimmed });
      void lookupMemberPartnerEligibility(trimmed).then((r) => {
        if (discarded) return;
        if (r.kind === "empty") {
          form.clearErrors("claimedMemberNumber");
          resetPartnerFields();
          return;
        }
        if (r.found) {
          form.clearErrors("claimedMemberNumber");
        } else {
          form.setError("claimedMemberNumber", {
            message: CLAIMED_MEMBER_NOT_IN_DIRECTORY,
          });
        }
        const eligible = r.found && r.isPengurus;
        setPartnerGate({
          status: "ready",
          forTrim: trimmed,
          found: r.found,
          isPengurus: r.isPengurus,
        });
        if (!eligible) {
          resetPartnerFields();
        }
      });
    }, 300);

    return () => {
      discarded = true;
      window.clearTimeout(timeoutId);
    };
  }, [claimedMemberTrim, form, resetPartnerFields]);

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

  const showPartnerSection =
    effectivePartnerGate.status === "ready" &&
    effectivePartnerGate.found &&
    effectivePartnerGate.isPengurus;

  return { effectivePartnerGate, showPartnerSection };
}
