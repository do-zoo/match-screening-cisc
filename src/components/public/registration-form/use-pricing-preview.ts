"use client";

import { useMemo } from "react";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import { computeSubmitTotal } from "@/lib/pricing/compute-submit-total";

export function usePricingPreview(
  event: SerializedEventForRegistration,
  primaryMandatoryMenuItemId: string | undefined,
  partnerMandatoryMenuItemId: string | undefined,
  claimedMemberNumber: string | undefined,
  qtyPartner: unknown,
  partnerIsMember?: boolean,
  managementPublicCode?: string | undefined,
) {
  return useMemo(() => {
    const qtyPartnerNorm: 0 | 1 = Number(qtyPartner ?? 0) === 1 ? 1 : 0;
    const includePartner = qtyPartnerNorm === 1;
    const partnerPriceType: "member" | "non_member" =
      partnerIsMember === true ? "member" : "non_member";
    const primaryMemberEligible =
      Boolean(claimedMemberNumber?.trim()) ||
      Boolean(managementPublicCode?.trim());

    const primaryMenu = event.mandatoryMenuItems.find(
      (m) => m.id === primaryMandatoryMenuItemId,
    );
    if (!primaryMenu) return null;

    let partnerMenu:
      | SerializedEventForRegistration["mandatoryMenuItems"][number]
      | undefined;
    if (includePartner) {
      partnerMenu = event.mandatoryMenuItems.find(
        (m) => m.id === partnerMandatoryMenuItemId,
      );
      if (!partnerMenu) return null;
    }

    try {
      return computeSubmitTotal({
        event: {
          ticketMemberPrice: event.ticketMemberPrice,
          ticketNonMemberPrice: event.ticketNonMemberPrice,
        },
        primaryPriceType: primaryMemberEligible ? "member" : "non_member",
        primaryMandatoryMenu: {
          name: primaryMenu.name,
          price: primaryMenu.price,
        },
        ...(includePartner && partnerMenu
          ? {
              partnerPriceType,
              partnerMandatoryMenu: {
                name: partnerMenu.name,
                price: partnerMenu.price,
              },
            }
          : {}),
      });
    } catch {
      return null;
    }
  }, [
    claimedMemberNumber,
    managementPublicCode,
    event,
    partnerIsMember,
    qtyPartner,
    primaryMandatoryMenuItemId,
    partnerMandatoryMenuItemId,
  ]);
}
