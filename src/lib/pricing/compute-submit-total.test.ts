import { describe, expect, it } from "vitest";

import { computeSubmitTotal } from "./compute-submit-total";

describe("computeSubmitTotal", () => {
  const baseEvent = {
    ticketMemberPrice: 500_000,
    ticketNonMemberPrice: 750_000,
  };

  it("calculates primary only", () => {
    const result = computeSubmitTotal({
      event: baseEvent,
      primaryPriceType: "member",
      primaryMandatoryMenu: { name: "Nasi", price: 150_000 },
    });

    expect(result.primaryTicketPrice).toBe(500_000);
    expect(result.primaryMenuPrice).toBe(150_000);
    expect(result.primaryTotal).toBe(500_000);
    expect(result.grandTotal).toBe(500_000);
    expect(result.lines).toHaveLength(2);
  });

  it("calculates primary + partner", () => {
    const result = computeSubmitTotal({
      event: baseEvent,
      primaryPriceType: "member",
      primaryMandatoryMenu: { name: "Nasi", price: 150_000 },
      partnerPriceType: "member",
      partnerMandatoryMenu: { name: "Lumpia", price: 100_000 },
    });

    expect(result.primaryTotal).toBe(500_000);
    expect(result.partnerTotal).toBe(500_000);
    expect(result.grandTotal).toBe(1_000_000);
    expect(result.lines).toHaveLength(4);
  });

  it("uses non-member price for partner when requested", () => {
    const result = computeSubmitTotal({
      event: baseEvent,
      primaryPriceType: "member",
      primaryMandatoryMenu: { name: "Nasi", price: 150_000 },
      partnerPriceType: "non_member",
      partnerMandatoryMenu: { name: "Lumpia", price: 100_000 },
    });

    expect(result.partnerTicketPrice).toBe(750_000);
    expect(result.grandTotal).toBe(1_250_000);
  });
});
