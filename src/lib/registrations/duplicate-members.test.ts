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

  it.each([
    { name: "empty array", candidates: [] },
    { name: "blank member number", candidates: [""] },
    { name: "undefined member number", candidates: [undefined] as string[] },
  ])("returns no duplicates for $name without querying", async ({ candidates }) => {
    const d = await findDuplicateMemberNumbers("evt", candidates);

    expect(d).toEqual([]);
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  it("returns no duplicates when there are no matching tickets", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce([]);

    const d = await findDuplicateMemberNumbers("evt", ["123", "456"]);

    expect(d).toEqual([]);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith({
      where: { eventId: "evt", memberNumber: { in: ["123", "456"] } },
      select: { memberNumber: true },
    });
  });

  it("returns duplicates when DB has same member on event", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce([
      { memberNumber: "123" } as never,
    ]);
    const d = await findDuplicateMemberNumbers("evt", ["123"]);
    expect(d).toEqual(["123"]);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith({
      where: { eventId: "evt", memberNumber: { in: ["123"] } },
      select: { memberNumber: true },
    });
  });

  it("returns only duplicate member numbers from a mixed list", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce([
      { memberNumber: "456" } as never,
    ]);

    const d = await findDuplicateMemberNumbers("evt", ["123", "456", "789"]);

    expect(d).toEqual(["456"]);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt",
        memberNumber: { in: ["123", "456", "789"] },
      },
      select: { memberNumber: true },
    });
  });

  it("dedupes repeated candidates before querying", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce([
      { memberNumber: "123" } as never,
    ]);

    const d = await findDuplicateMemberNumbers("evt", ["123", "123"]);

    expect(d).toEqual(["123"]);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith({
      where: { eventId: "evt", memberNumber: { in: ["123"] } },
      select: { memberNumber: true },
    });
  });
});
