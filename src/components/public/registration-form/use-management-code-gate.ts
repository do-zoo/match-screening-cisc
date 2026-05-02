"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { lookupManagementCodeForRegistration } from "@/lib/actions/lookup-management-code-for-registration";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

export type ManagementCodeGateState =
  | { status: "empty" }
  | { status: "checking"; forTrim: string }
  | {
      status: "ready";
      forTrim: string;
      found: true;
      fullName: string;
    }
  | {
      status: "ready";
      forTrim: string;
      found: false;
      reason: "not_found" | "not_assigned";
    };

/** Jalur identitas utama memakai `managementPublicCode` (tanpa nomor direktori). */
export function useManagementCodeGate(
  form: UseFormReturn<SubmitRegistrationInput>,
  managementCodeTrim: string,
  claimedMemberTrim: string,
) {
  const [gate, setGate] = useState<ManagementCodeGateState>({
    status: "empty",
  });

  useEffect(() => {
    if (claimedMemberTrim.length > 0) {
      queueMicrotask(() => {
        startTransition(() => {
          setGate({ status: "empty" });
        });
        form.clearErrors("managementPublicCode");
      });
      return;
    }

    const trimmed = managementCodeTrim.trim();
    if (!trimmed) {
      startTransition(() => {
        setGate({ status: "empty" });
      });
      form.clearErrors("managementPublicCode");
      return;
    }

    let discarded = false;
    const timeoutId = window.setTimeout(() => {
      form.clearErrors("managementPublicCode");
      startTransition(() => {
        setGate({ status: "checking", forTrim: trimmed });
      });
      void lookupManagementCodeForRegistration(trimmed).then((r) => {
        if (discarded) return;
        if (r.kind === "empty") {
          startTransition(() => {
            setGate({ status: "empty" });
          });
          return;
        }
        if (r.kind === "not_found" || r.kind === "not_assigned") {
          form.setError("managementPublicCode", {
            message:
              r.kind === "not_found"
                ? "Kode pengurus tidak dikenali."
                : "Pengurus tidak berada dalam kepengurusan aktif untuk periode ini.",
          });
          startTransition(() => {
            setGate({
              status: "ready",
              forTrim: trimmed,
              found: false,
              reason: r.kind === "not_found" ? "not_found" : "not_assigned",
            });
          });
          return;
        }

        form.clearErrors("managementPublicCode");
        if (form.getValues("purchaserIsMember")) {
          form.setValue("contactName", r.fullName.trim(), {
            shouldValidate: true,
          });
        }

        startTransition(() => {
          setGate({
            status: "ready",
            forTrim: trimmed,
            found: true,
            fullName: r.fullName,
          });
        });
      });
    }, 300);

    return () => {
      discarded = true;
      window.clearTimeout(timeoutId);
    };
  }, [claimedMemberTrim, form, managementCodeTrim]);

  const effectiveGate = useMemo((): ManagementCodeGateState => {
    const t = managementCodeTrim.trim();
    if (claimedMemberTrim.length > 0 || !t) return { status: "empty" };
    if (gate.status === "empty") return { status: "checking", forTrim: t };
    if (gate.status === "checking" && gate.forTrim !== t) {
      return { status: "checking", forTrim: t };
    }
    if (gate.status === "ready" && gate.forTrim !== t) {
      return { status: "checking", forTrim: t };
    }
    return gate;
  }, [claimedMemberTrim, gate, managementCodeTrim]);

  const directoryVerifiedByCode =
    effectiveGate.status === "ready" &&
    effectiveGate.found === true;

  return { effectiveManagementCodeGate: effectiveGate, directoryVerifiedByCode };
}
