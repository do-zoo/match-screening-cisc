"use client";

import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { primaryMemberSeatTakenForActiveEventSlug } from "@/lib/actions/check-member-seat-for-event";
import { lookupMemberPartnerEligibility } from "@/lib/actions/lookup-member-partner-eligibility";
import {
  MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
  MEMBER_NOT_IN_DIRECTORY_MESSAGE,
  type SubmitRegistrationInput,
} from "@/lib/forms/submit-registration-schema";

import type { PartnerMemberNumberGateState } from "./types";

export function usePartnerMemberNumberValidation(
  form: UseFormReturn<SubmitRegistrationInput>,
  eventSlug: string,
  showPartnerSection: boolean,
) {
  const qtyPartner = useWatch({ control: form.control, name: "qtyPartner" });
  const partnerIsMember = Boolean(
    useWatch({ control: form.control, name: "partnerIsMember" }),
  );
  const partnerMemberNumber = useWatch({
    control: form.control,
    name: "partnerMemberNumber",
  });
  const partnerTrim = String(partnerMemberNumber ?? "").trim();

  const [partnerMemberGate, setPartnerMemberGate] =
    useState<PartnerMemberNumberGateState>({
      status: "empty",
    });

  const enabled = Boolean(
    showPartnerSection && qtyPartner === 1 && partnerIsMember,
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (partnerTrim.length === 0) {
      form.clearErrors("partnerMemberNumber");
      return;
    }

    let discarded = false;
    const trimmed = partnerTrim;
    const timeoutId = window.setTimeout(() => {
      form.clearErrors("partnerMemberNumber");
      setPartnerMemberGate({ status: "checking", forTrim: trimmed });

      void lookupMemberPartnerEligibility(trimmed).then((r) => {
        if (discarded) return;

        if (r.kind === "empty") {
          form.clearErrors("partnerMemberNumber");
          setPartnerMemberGate({ status: "empty" });
          return;
        }

        if (!r.found) {
          form.setError("partnerMemberNumber", {
            message: MEMBER_NOT_IN_DIRECTORY_MESSAGE,
          });
          setPartnerMemberGate({
            status: "ready",
            forTrim: trimmed,
            found: false,
          });
          return;
        }

        const canon = r.canonicalMemberNumber;

        void primaryMemberSeatTakenForActiveEventSlug(eventSlug, canon).then(
          (seatTaken) => {
            if (discarded) return;

            form.setValue("partnerMemberNumber", canon, {
              shouldValidate: true,
            });

            if (seatTaken) {
              form.setError("partnerMemberNumber", {
                message: MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE,
              });
              setPartnerMemberGate({
                status: "ready",
                forTrim: canon,
                found: true,
                seatForEvent: "taken",
              });
              return;
            }

            form.clearErrors("partnerMemberNumber");
            setPartnerMemberGate({
              status: "ready",
              forTrim: canon,
              found: true,
              seatForEvent: "available",
            });
          },
        );
      });
    }, 300);

    return () => {
      discarded = true;
      window.clearTimeout(timeoutId);
    };
  }, [enabled, eventSlug, form, partnerTrim]);

  const effectivePartnerMemberGate: PartnerMemberNumberGateState =
    useMemo(() => {
      if (!enabled) {
        return { status: "empty" };
      }
      if (partnerTrim.length === 0) {
        return { status: "empty" };
      }
      if (partnerMemberGate.status === "empty") {
        return { status: "checking", forTrim: partnerTrim };
      }
      if (
        partnerMemberGate.status === "checking" &&
        partnerMemberGate.forTrim !== partnerTrim
      ) {
        return { status: "checking", forTrim: partnerTrim };
      }
      if (
        partnerMemberGate.status === "ready" &&
        partnerMemberGate.forTrim !== partnerTrim
      ) {
        return { status: "checking", forTrim: partnerTrim };
      }
      return partnerMemberGate;
    }, [enabled, partnerTrim, partnerMemberGate]);

  return { effectivePartnerMemberGate };
}
