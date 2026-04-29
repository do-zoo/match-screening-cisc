import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    ticket: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { findDuplicateMemberNumbers } from "@/lib/registrations/duplicate-members";

describe("findDuplicateMemberNumbers", () => {
  beforeEach(() => {
    vi.mocked(prisma.ticket.findMany).mockReset();
  });

  it("returns duplicates when DB has same member on event", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce([
      { memberNumber: "123" } as never,
    ]);
    const d = await findDuplicateMemberNumbers("evt", ["123"]);
    expect(d).toEqual(["123"]);
  });
});
