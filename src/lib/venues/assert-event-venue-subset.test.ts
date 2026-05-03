import { describe, expect, it } from "vitest";
import {
  linkedVenueMenuSignature,
  validateVenueSubsetForEvent,
} from "./assert-event-venue-subset";

describe("validateVenueSubsetForEvent", () => {
  it("rejects unknown id", () => {
    expect(
      validateVenueSubsetForEvent({
        eventVenueId: "v1",
        venueMenuItemIds: ["x"],
        catalogById: new Map(),
      }),
    ).toMatch(/katalog/);
  });

  it("rejects mismatched venue", () => {
    const m = new Map([["x", { venueId: "other" }]]);
    expect(
      validateVenueSubsetForEvent({
        eventVenueId: "v1",
        venueMenuItemIds: ["x"],
        catalogById: m,
      }),
    ).toMatch(/venue/);
  });

  it("accepts aligned ids", () => {
    const m = new Map([["x", { venueId: "v1" }]]);
    expect(
      validateVenueSubsetForEvent({
        eventVenueId: "v1",
        venueMenuItemIds: ["x"],
        catalogById: m,
      }),
    ).toBeNull();
  });
});

describe("linkedVenueMenuSignature", () => {
  it("is order-insensitive for ids", () => {
    expect(
      linkedVenueMenuSignature([
        { venueMenuItemId: "b", sortOrder: 1 },
        { venueMenuItemId: "a", sortOrder: 2 },
      ]),
    ).toBe(
      linkedVenueMenuSignature([
        { venueMenuItemId: "a", sortOrder: 2 },
        { venueMenuItemId: "b", sortOrder: 1 },
      ]),
    );
  });
});
