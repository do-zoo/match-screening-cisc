import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actions/guard", () => ({
  guardEvent: vi.fn().mockResolvedValue({
    profileId: "prof_test",
    role: "Verifier",
    helperEventIds: [],
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));

import { guardEvent } from "@/lib/actions/guard";
import { redeemVoucher } from "@/lib/actions/voucher-redemption";

describe("redeemVoucher", () => {
  beforeEach(() => {
    vi.mocked(guardEvent).mockClear();
  });

  it("returns stub error (voucher flow removed)", async () => {
    const result = await redeemVoucher("evt1", "ticket1", "menu1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rootError).toContain("tidak tersedia");
    }
    expect(guardEvent).toHaveBeenCalledWith("evt1");
  });
});
