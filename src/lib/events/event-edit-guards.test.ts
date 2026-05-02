import { describe, expect, it } from "vitest";

import {
  findLockedViolations,
  needsSensitiveAcknowledgement,
  type EventIntegritySnapshot,
} from "@/lib/events/event-edit-guards";

const persisted: EventIntegritySnapshot = {
  slug: "demo",
  menuMode: "PRESELECT",
  menuSelection: "SINGLE",
  ticketMemberPrice: 1,
  ticketNonMemberPrice: 2,
  voucherPrice: null,
  pricingSource: "global_default",
  picAdminProfileId: "a1",
  bankAccountId: "b1",
};

describe("findLockedViolations", () => {
  it("allows everything when registrationCount is 0", () => {
    expect(
      findLockedViolations({
        registrationCount: 0,
        persisted,
        candidate: { slug: "x", menuMode: "VOUCHER", menuSelection: "MULTI" },
      }),
    ).toEqual([]);
  });

  it("blocks slug/menu mutations when registrations exist", () => {
    expect(
      findLockedViolations({
        registrationCount: 3,
        persisted,
        candidate: { slug: "new" },
      }),
    ).toEqual(["slug"]);
    expect(
      findLockedViolations({
        registrationCount: 3,
        persisted,
        candidate: { menuMode: "VOUCHER" },
      }),
    ).toEqual(["menuMode"]);
  });
});

describe("needsSensitiveAcknowledgement", () => {
  it("detects pricing changes but not PIC-only omission", () => {
    expect(
      needsSensitiveAcknowledgement({
        persisted,
        candidate: { ticketMemberPrice: 9 },
      }),
    ).toBe(true);

    expect(
      needsSensitiveAcknowledgement({
        persisted,
        candidate: { voucherPrice: 10 },
      }),
    ).toBe(true);

    expect(
      needsSensitiveAcknowledgement({
        persisted,
        candidate: {},
      }),
    ).toBe(false);
  });
});
