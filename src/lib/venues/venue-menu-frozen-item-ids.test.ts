import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { eventVenueMenuItem: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/db/prisma";
import { venueMenuItemIdsFrozenByExistingRegistrations } from "./venue-menu-frozen-item-ids";

describe("venueMenuItemIdsFrozenByExistingRegistrations", () => {
  beforeEach(() => {
    vi.mocked(prisma.eventVenueMenuItem.findMany).mockReset();
  });

  it("returns ids for join rows tied to events with registrations", async () => {
    vi.mocked(prisma.eventVenueMenuItem.findMany).mockResolvedValueOnce([
      { venueMenuItemId: "a" },
      { venueMenuItemId: "b" },
    ] as never);
    const s = await venueMenuItemIdsFrozenByExistingRegistrations(prisma);
    expect(s.has("a")).toBe(true);
    expect(prisma.eventVenueMenuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { event: { registrations: { some: {} } } },
      }),
    );
  });
});
