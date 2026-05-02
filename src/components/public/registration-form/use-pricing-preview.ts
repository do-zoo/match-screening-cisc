"use client";

import { useMemo } from "react";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import { computeSubmitTotal } from "@/lib/pricing/compute-submit-total";

export function usePricingPreview(
  event: SerializedEventForRegistration,
  selectedMenuIds: string[],
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

    try {
      if (event.menuMode === "VOUCHER") {
        if (event.voucherPrice == null) {
          return null;
        }
        const menuParts: Parameters<
          typeof computeSubmitTotal
        >[0]["perTicketMenu"] = [{ mode: "VOUCHER" }];
        if (includePartner) menuParts.push({ mode: "VOUCHER" });

        return computeSubmitTotal({
          event: {
            ticketMemberPrice: event.ticketMemberPrice,
            ticketNonMemberPrice: event.ticketNonMemberPrice,
            menuMode: event.menuMode,
            voucherPrice: event.voucherPrice,
          },
          primaryPriceType: primaryMemberEligible ? "member" : "non_member",
          ...(includePartner ? { partnerPriceType } : {}),
          includePartner,
          perTicketMenu: menuParts,
        });
      }

      const items = event.menuItems.filter((m) =>
        selectedMenuIds.includes(m.id),
      );

      const menuParts: Parameters<
        typeof computeSubmitTotal
      >[0]["perTicketMenu"] = [
        {
          mode: "PRESELECT",
          selectedMenuItems: items.map((m) => ({
            name: m.name,
            price: m.price,
          })),
        },
      ];

      if (includePartner) {
        menuParts.push({
          mode: "PRESELECT",
          selectedMenuItems: items.map((m) => ({
            name: m.name,
            price: m.price,
          })),
        });
      }

      return computeSubmitTotal({
        event: {
          ticketMemberPrice: event.ticketMemberPrice,
          ticketNonMemberPrice: event.ticketNonMemberPrice,
          menuMode: event.menuMode,
          voucherPrice: event.voucherPrice,
        },
        primaryPriceType: primaryMemberEligible ? "member" : "non_member",
        ...(includePartner ? { partnerPriceType } : {}),
        includePartner,
        perTicketMenu: menuParts,
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
    selectedMenuIds,
  ]);
}
