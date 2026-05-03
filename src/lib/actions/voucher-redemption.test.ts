import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    ticket: { findUnique: vi.fn() },
    venueMenuItem: { findUnique: vi.fn() },
    event: { findUnique: vi.fn() },
    eventVenueMenuItem: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/actions/guard", () => ({
  guardEvent: vi.fn().mockResolvedValue({
    profileId: "prof_test",
    role: "Verifier",
    helperEventIds: [],
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { redeemVoucher } from "@/lib/actions/voucher-redemption";

describe("redeemVoucher", () => {
  beforeEach(() => {
    vi.mocked(prisma.ticket.findUnique).mockReset();
    vi.mocked(prisma.venueMenuItem.findUnique).mockReset();
    vi.mocked(prisma.event.findUnique).mockReset();
    vi.mocked(prisma.eventVenueMenuItem.findUnique).mockReset();
  });

  it("returns error if ticket not in event", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(null);
    const result = await redeemVoucher("evt1", "ticket1", "menu1");
    expect(result.ok).toBe(false);
  });

  it("returns error if menu item not voucherEligible", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
      id: "ticket1",
      eventId: "evt1",
      voucherRedeemedMenuItemId: null,
      registration: { event: { menuMode: "VOUCHER", id: "evt1" } },
    } as never);
    vi.mocked(prisma.venueMenuItem.findUnique).mockResolvedValueOnce({
      id: "menu1",
      venueId: "ven1",
      voucherEligible: false,
    } as never);
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce({
      venueId: "ven1",
    } as never);
    vi.mocked(prisma.eventVenueMenuItem.findUnique).mockResolvedValueOnce({
      eventId: "evt1",
    } as never);
    const result = await redeemVoucher("evt1", "ticket1", "menu1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rootError).toContain("tidak eligible");
  });
});
