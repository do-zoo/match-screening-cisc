import { describe, expect, it } from "vitest";

import { pathsMatchRegistrationDetail } from "@/lib/admin/event-inbox-detail-path";

describe("pathsMatchRegistrationDetail", () => {
  const eventId = "evt_123";

  it("returns false for exact inbox list path", () => {
    expect(
      pathsMatchRegistrationDetail(`/admin/events/${eventId}/inbox`, eventId),
    ).toBe(false);
  });

  it("returns true for registration detail under inbox", () => {
    expect(
      pathsMatchRegistrationDetail(
        `/admin/events/${eventId}/inbox/reg_abc`,
        eventId,
      ),
    ).toBe(true);
  });

  it("returns false for unrelated path", () => {
    expect(
      pathsMatchRegistrationDetail(`/admin/events/${eventId}/report`, eventId),
    ).toBe(false);
  });
});
