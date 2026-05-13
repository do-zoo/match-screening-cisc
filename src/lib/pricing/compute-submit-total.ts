import type { TicketPriceType } from "@prisma/client";

export type PricingLineRole = "primary" | "partner";

export type PricingLine =
  | { kind: "ticket"; role: PricingLineRole; label: string; amount: number }
  | { kind: "menu"; role: PricingLineRole; label: string; amount: number };

export type SubmitPricingInput = {
  event: {
    ticketMemberPrice: number;
    ticketNonMemberPrice: number;
  };
  primaryPriceType: Extract<TicketPriceType, "member" | "non_member">;
  primaryMandatoryMenu: { name: string; price: number };

  partnerPriceType?: Extract<TicketPriceType, "member" | "non_member">;
  partnerMandatoryMenu?: { name: string; price: number };
};

export type SubmitPricingResult = {
  primaryTicketPrice: number;
  primaryMenuPrice: number;
  primaryTotal: number;

  partnerTicketPrice?: number;
  partnerMenuPrice?: number;
  partnerTotal?: number;

  grandTotal: number;
  lines: PricingLine[];
};

function ticketPrice(
  input: SubmitPricingInput,
  role: "primary" | "partner",
): number {
  const priceType =
    role === "primary" ? input.primaryPriceType : input.partnerPriceType;
  if (priceType === "non_member") return input.event.ticketNonMemberPrice;
  return input.event.ticketMemberPrice;
}

function ticketLabel(priceType: TicketPriceType): string {
  return priceType === "non_member" ? "Tiket Non-member" : "Tiket Member";
}

export function computeSubmitTotal(input: SubmitPricingInput): SubmitPricingResult {
  const lines: PricingLine[] = [];

  const primaryTicket = ticketPrice(input, "primary");
  const primaryMenu = input.primaryMandatoryMenu.price;
  const primaryTotal = primaryTicket + primaryMenu;

  lines.push({
    kind: "ticket",
    role: "primary",
    label: ticketLabel(input.primaryPriceType),
    amount: primaryTicket,
  });
  lines.push({
    kind: "menu",
    role: "primary",
    label: `Menu — ${input.primaryMandatoryMenu.name}`,
    amount: primaryMenu,
  });

  let partnerTicket: number | undefined;
  let partnerMenu: number | undefined;
  let partnerTotal: number | undefined;

  if (input.partnerMandatoryMenu && input.partnerPriceType) {
    partnerTicket = ticketPrice(input, "partner");
    partnerMenu = input.partnerMandatoryMenu.price;
    partnerTotal = partnerTicket + partnerMenu;

    lines.push({
      kind: "ticket",
      role: "partner",
      label: ticketLabel(input.partnerPriceType),
      amount: partnerTicket,
    });
    lines.push({
      kind: "menu",
      role: "partner",
      label: `Menu — ${input.partnerMandatoryMenu.name}`,
      amount: partnerMenu,
    });
  }

  const grandTotal = primaryTotal + (partnerTotal ?? 0);

  return {
    primaryTicketPrice: primaryTicket,
    primaryMenuPrice: primaryMenu,
    primaryTotal,
    partnerTicketPrice: partnerTicket,
    partnerMenuPrice: partnerMenu,
    partnerTotal,
    grandTotal,
    lines,
  };
}
