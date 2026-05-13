import { describe, expect, it } from "vitest";

import {
  findLockedViolations,
  findMandatoryMenuLockedViolation,
  needsSensitiveAcknowledgement,
  type EventIntegritySnapshot,
} from "@/lib/events/event-edit-guards";

const persisted: EventIntegritySnapshot = {
  slug: "demo",
  venueId: "v1",
  mandatoryMenuItemIds: ["m1"],
  ticketMemberPrice: 1,
  ticketNonMemberPrice: 2,
  picAdminProfileId: "a1",
  bankAccountId: "b1",
};

describe("findLockedViolations", () => {
  it("allows everything when registrationCount is 0", () => {
    expect(
      findLockedViolations({
        registrationCount: 0,
        persisted,
        candidate: { venueId: "v2" },
      }),
    ).toEqual([]);
  });

  it("blocks slug/venue mutations when registrations exist", () => {
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
        candidate: { venueId: "v2" },
      }),
    ).toEqual(["venueId"]);
  });
});

describe("findMandatoryMenuLockedViolation", () => {
  it("flags mandatory menu set changes when registrations exist", () => {
    expect(
      findMandatoryMenuLockedViolation({
        registrationCount: 3,
        persisted,
        candidateMandatoryMenuItemIds: ["m2"],
      }),
    ).toBe(true);
    expect(
      findMandatoryMenuLockedViolation({
        registrationCount: 3,
        persisted,
        candidateMandatoryMenuItemIds: ["m1"],
      }),
    ).toBe(false);
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
        candidate: {},
      }),
    ).toBe(false);
  });
});
