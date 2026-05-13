import { describe, it, expect } from "vitest";
import {
  getSettlementExpectedAmounts,
  settlementAmountMismatch,
  SETTLEMENT_AMOUNT_TOLERANCE_IDR,
} from "./settlement-expected-amounts";

describe("getSettlementExpectedAmounts", () => {
  it("maps finance snapshot to venue and treasurer expectations", () => {
    expect(
      getSettlementExpectedAmounts({
        baselineTotalApproved: 1_400_000,
        menuVenuePayoutApproved: 400_000,
        adjustmentsPaidTotal: 50_000,
      }),
    ).toEqual({ venueMenuPayout: 400_000, treasurerMargin: 1_050_000 });
  });
});

describe("settlementAmountMismatch", () => {
  it("is within tolerance at exact boundary", () => {
    const { withinTolerance, delta } = settlementAmountMismatch(
      100 + SETTLEMENT_AMOUNT_TOLERANCE_IDR,
      100,
    );
    expect(withinTolerance).toBe(true);
    expect(delta).toBe(SETTLEMENT_AMOUNT_TOLERANCE_IDR);
  });

  it("is outside tolerance when beyond boundary", () => {
    const { withinTolerance } = settlementAmountMismatch(
      SETTLEMENT_AMOUNT_TOLERANCE_IDR + 2,
      0,
    );
    expect(withinTolerance).toBe(false);
  });
});
