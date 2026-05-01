import { MenuMode } from "@prisma/client";

import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

export type RegistrationStepId = "purchaser" | "partner" | "menu" | "payment";

/** Canonical order — used when the visible step list gains/loses rows. */
export const REGISTRATION_STEP_ORDER = [
  "purchaser",
  "partner",
  "menu",
  "payment",
] as const satisfies readonly RegistrationStepId[];

export function buildRegistrationSteps(
  menuMode: MenuMode,
  showPartnerSection: boolean,
): RegistrationStepId[] {
  const steps: RegistrationStepId[] = ["purchaser"];
  if (showPartnerSection) steps.push("partner");
  if (menuMode === MenuMode.PRESELECT) steps.push("menu");
  steps.push("payment");
  return steps;
}

/** When optional steps disappear (e.g. partner gate), remap to next valid canonical step still in view. */
export function resolveActiveStepAfterStepsChange(
  currentId: RegistrationStepId,
  steps: RegistrationStepId[],
): RegistrationStepId {
  if (steps.includes(currentId)) return currentId;
  const start =
    REGISTRATION_STEP_ORDER.indexOf(currentId) >= 0
      ? REGISTRATION_STEP_ORDER.indexOf(currentId)
      : 0;
  for (let i = start; i < REGISTRATION_STEP_ORDER.length; i++) {
    const id = REGISTRATION_STEP_ORDER[i];
    if (steps.includes(id)) return id;
  }
  const last = steps[steps.length - 1];
  return last ?? "purchaser";
}

export function registrationStepTitle(id: RegistrationStepId): string {
  switch (id) {
    case "purchaser":
      return "Informasi pemesan";
    case "partner":
      return "Tiket partner";
    case "menu":
      return "Pilihan menu";
    case "payment":
      return "Pembayaran";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

/** Field order used when focusing the first failing field after trigger(). */
export function getTriggerFieldsForStep(
  stepId: RegistrationStepId,
  qtyPartner: SubmitRegistrationInput["qtyPartner"],
  opts?: {
    /** Langkah purchaser wajib mengisi ini; boleh dihilangkan untuk tes / langkah partner saja. */
    purchaserIsMember?: boolean;
    /** Penuntasan nomor di direktori sebelum blok kontak + foto kartu membuka (wajib eksplisit untuk path member). */
    directoryVerified?: boolean;
    partnerIsMember?: boolean;
    /** Direktori + kursi event untuk nomor partner (path member tiket partner). */
    partnerDirectoryVerified?: boolean;
  },
): (keyof SubmitRegistrationInput)[] {
  switch (stepId) {
    case "purchaser":
      if (opts?.purchaserIsMember === undefined) {
        return ["purchaserIsMember"];
      }
      if (opts?.purchaserIsMember === false) {
        return ["purchaserIsMember", "contactName", "contactWhatsapp"];
      }
      const dirOk = opts?.directoryVerified === true;
      if (opts?.purchaserIsMember === true && !dirOk) {
        return ["purchaserIsMember", "claimedMemberNumber"];
      }
      return [
        "purchaserIsMember",
        "claimedMemberNumber",
        "contactName",
        "contactWhatsapp",
        "memberCardPhoto",
      ];
    case "partner":
      if (qtyPartner === 1) {
        if (opts?.partnerIsMember === undefined) {
          return ["qtyPartner", "partnerIsMember"];
        }
        if (opts?.partnerIsMember === false) {
          return [
            "qtyPartner",
            "partnerIsMember",
            "partnerName",
            "partnerWhatsapp",
          ];
        }
        const pDirOk = opts?.partnerDirectoryVerified === true;
        if (opts?.partnerIsMember === true && !pDirOk) {
          return ["qtyPartner", "partnerIsMember", "partnerMemberNumber"];
        }
        return [
          "qtyPartner",
          "partnerIsMember",
          "partnerMemberNumber",
          "partnerMemberCardPhoto",
          "partnerName",
          "partnerWhatsapp",
        ];
      }
      return ["qtyPartner"];
    case "menu":
      return ["selectedMenuItemIds"];
    case "payment":
      // Final step uses handleSubmit (full schema); no per-step trigger.
      return [];
    default: {
      const _exhaustive: never = stepId;
      return _exhaustive;
    }
  }
}
