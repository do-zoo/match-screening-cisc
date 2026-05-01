import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    ticket: { findUnique: vi.fn() },
    eventMenuItem: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/actions/guard", () => ({
  guardEvent: vi.fn().mockResolvedValue({ role: "Verifier", helperEventIds: [] }),
  isAuthError: vi.fn().mockReturnValue(false),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { redeemVoucher } from "@/lib/actions/voucher-redemption";

describe("redeemVoucher", () => {
  beforeEach(() => {
    vi.mocked(prisma.ticket.findUnique).mockReset();
    vi.mocked(prisma.eventMenuItem.findUnique).mockReset();
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
    vi.mocked(prisma.eventMenuItem.findUnique).mockResolvedValueOnce({
      id: "menu1",
      eventId: "evt1",
      voucherEligible: false,
    } as never);
    const result = await redeemVoucher("evt1", "ticket1", "menu1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rootError).toContain("tidak eligible");
  });
});
