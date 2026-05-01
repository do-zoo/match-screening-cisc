"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { primaryMemberSeatTakenForActiveEventSlug } from "@/lib/actions/check-member-seat-for-event";
import { lookupMemberPartnerEligibility } from "@/lib/actions/lookup-member-partner-eligibility";
import {
  MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
  type SubmitRegistrationInput,
} from "@/lib/forms/submit-registration-schema";

import type { PartnerGateState } from "./types";

const CLAIMED_MEMBER_NOT_IN_DIRECTORY =
  "Nomor member tidak dikenali atau tidak aktif di direktori kami.";

export function usePartnerGate(
  form: UseFormReturn<SubmitRegistrationInput>,
  eventSlug: string,
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
      form.clearErrors("claimedMemberNumber");
      setPartnerGate({ status: "checking", forTrim: trimmed });
      void lookupMemberPartnerEligibility(trimmed).then((r) => {
        if (discarded) return;
        if (r.kind === "empty") {
          form.clearErrors("claimedMemberNumber");
          resetPartnerFields();
          return;
        }
        if (!r.found) {
          form.setError("claimedMemberNumber", {
            message: CLAIMED_MEMBER_NOT_IN_DIRECTORY,
          });
          form.setValue("memberCardPhoto", undefined, {
            shouldValidate: false,
          });
          form.clearErrors("memberCardPhoto");
          setPartnerGate({
            status: "ready",
            forTrim: trimmed,
            found: false,
            isPengurus: false,
          });
          resetPartnerFields();
          return;
        }

        const canon = r.canonicalMemberNumber;

        void primaryMemberSeatTakenForActiveEventSlug(eventSlug, canon).then(
          (seatTaken) => {
            if (discarded) return;

            form.setValue("claimedMemberNumber", canon, {
              shouldValidate: true,
            });

            if (seatTaken) {
              form.setError("claimedMemberNumber", {
                message: MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
              });
              form.setValue("memberCardPhoto", undefined, {
                shouldValidate: false,
              });
              form.clearErrors("memberCardPhoto");
              setPartnerGate({
                status: "ready",
                forTrim: canon,
                found: true,
                isPengurus: r.isPengurus,
                seatForEvent: "taken",
              });
              resetPartnerFields();
              return;
            }

            form.clearErrors("claimedMemberNumber");
            if (form.getValues("purchaserIsMember")) {
              form.setValue("contactName", r.fullName.trim(), {
                shouldValidate: true,
              });
              const w = r.whatsapp?.trim();
              if (w) {
                form.setValue("contactWhatsapp", w, { shouldValidate: true });
              }
            }

            setPartnerGate({
              status: "ready",
              forTrim: canon,
              found: true,
              isPengurus: r.isPengurus,
              seatForEvent: "available",
            });
            if (!r.isPengurus) resetPartnerFields();
          },
        );
      });
    }, 300);

    return () => {
      discarded = true;
      window.clearTimeout(timeoutId);
    };
  }, [claimedMemberTrim, eventSlug, form, resetPartnerFields]);

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
    effectivePartnerGate.seatForEvent === "available" &&
    effectivePartnerGate.isPengurus;

  return { effectivePartnerGate, showPartnerSection };
}
