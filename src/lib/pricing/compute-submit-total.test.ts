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
        { mode: "PRESELECT", selectedMenuItems: [{ price: 50_000 }] },
      ],
    };
    expect(computeSubmitTotal(input)).toEqual({
      ticketMemberPriceApplied: 100_000,
      ticketNonMemberPriceApplied: 150_000,
      voucherPriceApplied: null,
      computedTotalAtSubmit: 200_000,
    });
  });

  it("member + partner privilege uses member price for partner ticket (voucher mode)", () => {
    const input: SubmitPricingInput = {
      event: { ...baseEvent, menuMode: "VOUCHER", voucherPrice: 75_000 },
      primaryPriceType: "member",
      includePartner: true,
      perTicketMenu: [{ mode: "VOUCHER" }, { mode: "VOUCHER" }],
    };
    expect(computeSubmitTotal(input).computedTotalAtSubmit).toBe(
      100_000 + 75_000 + 100_000 + 75_000,
    );
  });
});
