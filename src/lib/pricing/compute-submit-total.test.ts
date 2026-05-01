import { describe, expect, it } from "vitest";
import {
  computeSubmitTotal,
  type SubmitPricingInput,
} from "@/lib/pricing/compute-submit-total";

const baseEvent = {
  ticketMemberPrice: 100_000,
  ticketNonMemberPrice: 150_000,
  menuMode: "PRESELECT" as const,
  voucherPrice: null as number | null,
};

describe("computeSubmitTotal", () => {
  it("single non-member PRESELECT sums ticket + menu", () => {
    const input: SubmitPricingInput = {
      event: { ...baseEvent, menuMode: "PRESELECT", voucherPrice: null },
      primaryPriceType: "non_member",
      includePartner: false,
      perTicketMenu: [
        {
          mode: "PRESELECT",
          selectedMenuItems: [{ name: "Bakmi GM", price: 50_000 }],
        },
      ],
    };
    const result = computeSubmitTotal(input);
    expect(result).toMatchObject({
      ticketMemberPriceApplied: 100_000,
      ticketNonMemberPriceApplied: 150_000,
      voucherPriceApplied: null,
      computedTotalAtSubmit: 200_000,
    });
    expect(result.lines).toEqual([
      {
        kind: "ticket",
        role: "primary",
        label: "Tiket Non-member",
        amount: 150_000,
      },
      {
        kind: "menu_item",
        role: "primary",
        label: "Menu — Bakmi GM",
        amount: 50_000,
      },
    ]);
  });

  it("member + partner privilege uses member price for partner ticket (voucher mode)", () => {
    const input: SubmitPricingInput = {
      event: { ...baseEvent, menuMode: "VOUCHER", voucherPrice: 75_000 },
      primaryPriceType: "member",
      includePartner: true,
      perTicketMenu: [{ mode: "VOUCHER" }, { mode: "VOUCHER" }],
    };
    const result = computeSubmitTotal(input);
    expect(result.computedTotalAtSubmit).toBe(
      100_000 + 75_000 + 100_000 + 75_000,
    );
    expect(result.lines).toEqual([
      {
        kind: "ticket",
        role: "primary",
        label: "Tiket Member",
        amount: 100_000,
      },
      {
        kind: "voucher",
        role: "primary",
        label: "Voucher menu",
        amount: 75_000,
      },
      {
        kind: "ticket",
        role: "partner",
        label: "Tiket Member",
        amount: 100_000,
      },
      {
        kind: "voucher",
        role: "partner",
        label: "Voucher menu",
        amount: 75_000,
      },
    ]);
  });

  it("throws a clear error when VOUCHER mode has no voucher price", () => {
    const input: SubmitPricingInput = {
      event: { ...baseEvent, menuMode: "VOUCHER", voucherPrice: null },
      primaryPriceType: "member",
      includePartner: false,
      perTicketMenu: [{ mode: "VOUCHER" }],
    };

    expect(() => computeSubmitTotal(input)).toThrow(
      "voucherPrice required for VOUCHER menu mode",
    );
  });

  it("partner non-member ticket uses non-member price", () => {
    const input: SubmitPricingInput = {
      event: { ...baseEvent, menuMode: "PRESELECT", voucherPrice: null },
      primaryPriceType: "member",
      includePartner: true,
      partnerPriceType: "non_member",
      perTicketMenu: [
        {
          mode: "PRESELECT",
          selectedMenuItems: [{ name: "A", price: 40_000 }],
        },
        {
          mode: "PRESELECT",
          selectedMenuItems: [{ name: "A", price: 40_000 }],
        },
      ],
    };
    const result = computeSubmitTotal(input);
    const partnerTicket = result.lines.find(
      (l) => l.kind === "ticket" && l.role === "partner",
    );
    expect(partnerTicket?.amount).toBe(150_000);
    expect(partnerTicket?.label).toBe("Tiket Non-member");
    expect(result.computedTotalAtSubmit).toBe(
      100_000 + 150_000 + 40_000 + 40_000,
    );
  });

  it("throws a clear error when partner PRESELECT is missing a menu entry", () => {
    const input: SubmitPricingInput = {
      event: { ...baseEvent, menuMode: "PRESELECT", voucherPrice: null },
      primaryPriceType: "member",
      includePartner: true,
      perTicketMenu: [
        {
          mode: "PRESELECT",
          selectedMenuItems: [{ name: "A", price: 50_000 }],
        },
      ],
    };

    expect(() => computeSubmitTotal(input)).toThrow(
      "perTicketMenu requires at least 2 entries when includePartner is true",
    );
  });
});
