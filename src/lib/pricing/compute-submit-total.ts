import type { MenuMode, TicketPriceType } from "@prisma/client";

export type SubmitPricingInput = {
  event: {
    ticketMemberPrice: number;
    ticketNonMemberPrice: number;
    menuMode: MenuMode;
    voucherPrice: number | null;
  };
  primaryPriceType: Extract<TicketPriceType, "member" | "non_member">;
  includePartner: boolean;
  perTicketMenu: Array<
    | { mode: "PRESELECT"; selectedMenuItems: { price: number }[] }
    | { mode: "VOUCHER" }
  >;
};

export type SubmitPricingResult = {
  ticketMemberPriceApplied: number;
  ticketNonMemberPriceApplied: number;
  voucherPriceApplied: number | null;
  computedTotalAtSubmit: number;
};

function ticketLineRupiah(
  input: SubmitPricingInput,
  ticket: {
    role: "primary" | "partner";
    priceType: TicketPriceType;
  },
): number {
  const { event } = input;
  if (ticket.priceType === "non_member") return event.ticketNonMemberPrice;
  if (ticket.priceType === "member") return event.ticketMemberPrice;
  return event.ticketMemberPrice;
}

function menuLineRupiah(
  event: SubmitPricingInput["event"],
  ent: SubmitPricingInput["perTicketMenu"][number],
): number {
  if (event.menuMode === "VOUCHER") {
    if (event.voucherPrice == null) {
      throw new Error("voucherPrice required for VOUCHER menu mode");
    }
    return event.voucherPrice;
  }
  if (ent.mode !== "PRESELECT") {
    throw new Error("PRESELECT requires selected menus per ticket");
  }
  return ent.selectedMenuItems.reduce((s, i) => s + i.price, 0);
}

export function computeSubmitTotal(
  input: SubmitPricingInput,
): SubmitPricingResult {
  const requiredMenuEntries = input.includePartner ? 2 : 1;
  if (input.perTicketMenu.length < requiredMenuEntries) {
    throw new Error(
      `perTicketMenu requires at least ${requiredMenuEntries} ${requiredMenuEntries === 1 ? "entry" : "entries"} when includePartner is ${input.includePartner}`,
    );
  }

  const ticketMemberPriceApplied = input.event.ticketMemberPrice;
  const ticketNonMemberPriceApplied = input.event.ticketNonMemberPrice;
  const voucherPriceApplied =
    input.event.menuMode === "VOUCHER" ? input.event.voucherPrice : null;

  const primaryType: TicketPriceType =
    input.primaryPriceType === "member" ? "member" : "non_member";

  const lines: number[] = [];

  lines.push(
    ticketLineRupiah(input, { role: "primary", priceType: primaryType }),
  );
  lines.push(menuLineRupiah(input.event, input.perTicketMenu[0]));

  if (input.includePartner) {
    lines.push(
      ticketLineRupiah(input, {
        role: "partner",
        priceType: "privilege_partner_member_price",
      }),
    );
    lines.push(menuLineRupiah(input.event, input.perTicketMenu[1]));
  }

  const computedTotalAtSubmit = lines.reduce((a, b) => a + b, 0);

  return {
    ticketMemberPriceApplied,
    ticketNonMemberPriceApplied,
    voucherPriceApplied,
    computedTotalAtSubmit,
  };
}
