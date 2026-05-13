import { describe, expect, it } from "vitest";

import {
  buildEventRegistrantsListUrl,
  parseEventRegistrantsTab,
  registrationListWhere,
} from "@/lib/admin/event-registrants-list-url";

describe("event-registrants-list-url", () => {
  const eventId = "evt_1";

  it("parseEventRegistrantsTab defaults unknown to all", () => {
    expect(parseEventRegistrantsTab(undefined)).toBe("all");
    expect(parseEventRegistrantsTab("bogus")).toBe("all");
  });

  it("parseEventRegistrantsTab accepts known tabs", () => {
    expect(parseEventRegistrantsTab("pending_review")).toBe("pending_review");
    expect(parseEventRegistrantsTab("closed")).toBe("closed");
  });

  it("buildEventRegistrantsListUrl omits default tab and cards view", () => {
    expect(
      buildEventRegistrantsListUrl(eventId, {
        tab: "all",
        view: "cards",
        q: undefined,
      }),
    ).toBe(`/admin/events/${eventId}/registrants`);
  });

  it("buildEventRegistrantsListUrl encodes tab, view, q, page", () => {
    const url = buildEventRegistrantsListUrl(eventId, {
      tab: "pending_review",
      view: "table",
      q: "foo",
      page: 2,
    });
    expect(url).toContain("tab=pending_review");
    expect(url).toContain("view=tabel");
    expect(url).toContain("q=foo");
    expect(url).toContain("page=2");
  });

  it("registrationListWhere maps closed to cancelled and refunded", () => {
    const w = registrationListWhere(eventId, "closed", "");
    expect(w).toEqual({
      AND: [
        { eventId },
        { status: { in: ["cancelled", "refunded"] } },
      ],
    });
  });
});
