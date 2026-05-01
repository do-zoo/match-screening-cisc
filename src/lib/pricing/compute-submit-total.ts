import type { MenuMode, TicketPriceType } from "@prisma/client";

export type PricingLineRole = "primary" | "partner";

export type PricingLine =
  | { kind: "ticket"; role: PricingLineRole; label: string; amount: number }
  | { kind: "menu_item"; role: PricingLineRole; label: string; amount: number }
  | { kind: "voucher"; role: PricingLineRole; label: string; amount: number };

export type SubmitPricingInput = {
  event: {
    ticketMemberPrice: number;
    ticketNonMemberPrice: number;
    menuMode: MenuMode;
    voucherPrice: number | null;
  };
  primaryPriceType: Extract<TicketPriceType, "member" | "non_member">;
  /** Harga tiket partner; tidak dipakai jika tidak ada tiket partner. Default `member`. */
  partnerPriceType?: Extract<TicketPriceType, "member" | "non_member">;
  includePartner: boolean;
  perTicketMenu: Array<
    | {
        mode: "PRESELECT";
        selectedMenuItems: { name: string; price: number }[];
      }
    | { mode: "VOUCHER" }
  >;
};

export type SubmitPricingResult = {
  ticketMemberPriceApplied: number;
  ticketNonMemberPriceApplied: number;
  voucherPriceApplied: number | null;
  computedTotalAtSubmit: number;
  lines: PricingLine[];
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

function ticketLabel(priceType: TicketPriceType): string {
  if (priceType === "non_member") return "Tiket Non-member";
  if (priceType === "member") return "Tiket Member";
  return "Tiket Member";
}

function appendMenuLines(
  out: PricingLine[],
  role: PricingLineRole,
  event: SubmitPricingInput["event"],
  ent: SubmitPricingInput["perTicketMenu"][number],
): void {
  if (event.menuMode === "VOUCHER") {
    if (event.voucherPrice == null) {
      throw new Error("voucherPrice required for VOUCHER menu mode");
    }
    out.push({
      kind: "voucher",
      role,
      label: "Voucher menu",
      amount: event.voucherPrice,
    });
    return;
  }
  if (ent.mode !== "PRESELECT") {
    throw new Error("PRESELECT requires selected menus per ticket");
  }
  for (const item of ent.selectedMenuItems) {
    out.push({
      kind: "menu_item",
      role,
      label: `Menu — ${item.name}`,
      amount: item.price,
    });
  }
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

  const lines: PricingLine[] = [];

  const primaryTicketAmount = ticketLineRupiah(input, {
    role: "primary",
    priceType: primaryType,
  });
  lines.push({
    kind: "ticket",
    role: "primary",
    label: ticketLabel(primaryType),
    amount: primaryTicketAmount,
  });
  appendMenuLines(lines, "primary", input.event, input.perTicketMenu[0]);

  if (input.includePartner) {
    const partnerTicketPriceType: Extract<
      TicketPriceType,
      "member" | "non_member"
    > =
      input.partnerPriceType === "non_member" ? "non_member" : "member";
    const partnerTicketAmount = ticketLineRupiah(input, {
      role: "partner",
      priceType: partnerTicketPriceType,
    });
    lines.push({
      kind: "ticket",
      role: "partner",
      label: ticketLabel(partnerTicketPriceType),
      amount: partnerTicketAmount,
    });
    appendMenuLines(lines, "partner", input.event, input.perTicketMenu[1]);
  }

  const computedTotalAtSubmit = lines.reduce((a, l) => a + l.amount, 0);

  return {
    ticketMemberPriceApplied,
    ticketNonMemberPriceApplied,
    voucherPriceApplied,
    computedTotalAtSubmit,
    lines,
  };
}
