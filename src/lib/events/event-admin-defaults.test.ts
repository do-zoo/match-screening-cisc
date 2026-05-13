import { describe, expect, it } from "vitest";

import {
  COMMITTEE_TICKET_FALLBACK_MEMBER_IDR,
  COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR,
} from "./event-admin-defaults";

describe("event-admin-defaults", () => {
  it("fallback harga tiket positif", () => {
    expect(COMMITTEE_TICKET_FALLBACK_MEMBER_IDR).toBeGreaterThan(0);
    expect(COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR).toBeGreaterThan(0);
    expect(COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR).toBeGreaterThanOrEqual(
      COMMITTEE_TICKET_FALLBACK_MEMBER_IDR,
    );
  });
});
