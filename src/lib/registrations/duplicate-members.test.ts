import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    registration: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { findDuplicateMemberNumbers } from "@/lib/registrations/duplicate-members";

describe("findDuplicateMemberNumbers", () => {
  beforeEach(() => {
    vi.mocked(prisma.registration.findMany).mockReset();
  });

  it.each([
    { name: "empty array", candidates: [] },
    { name: "blank member number", candidates: [""] },
    {
      name: "undefined member number",
      candidates: [undefined] as unknown as string[],
    },
  ])("returns no duplicates for $name without querying", async ({ candidates }) => {
    const d = await findDuplicateMemberNumbers("evt", candidates);

    expect(d).toEqual([]);
    expect(prisma.registration.findMany).not.toHaveBeenCalled();
  });

  it("returns no duplicates when there are no matching registrations", async () => {
    vi.mocked(prisma.registration.findMany).mockResolvedValueOnce([]);

    const d = await findDuplicateMemberNumbers("evt", ["123", "456"]);

    expect(d).toEqual([]);
    expect(prisma.registration.findMany).toHaveBeenCalledWith({
      where: { eventId: "evt", claimedMemberNumber: { in: ["123", "456"] } },
      select: { claimedMemberNumber: true },
    });
  });

  it("returns duplicates when DB has same member on event", async () => {
    vi.mocked(prisma.registration.findMany).mockResolvedValueOnce([
      { claimedMemberNumber: "123" } as never,
    ]);
    const d = await findDuplicateMemberNumbers("evt", ["123"]);
    expect(d).toEqual(["123"]);
  });

  it("returns only duplicate member numbers from a mixed list", async () => {
    vi.mocked(prisma.registration.findMany).mockResolvedValueOnce([
      { claimedMemberNumber: "456" } as never,
    ]);

    const d = await findDuplicateMemberNumbers("evt", ["123", "456", "789"]);

    expect(d).toEqual(["456"]);
    expect(prisma.registration.findMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt",
        claimedMemberNumber: { in: ["123", "456", "789"] },
      },
      select: { claimedMemberNumber: true },
    });
  });

  it("dedupes repeated candidates before querying", async () => {
    vi.mocked(prisma.registration.findMany).mockResolvedValueOnce([
      { claimedMemberNumber: "123" } as never,
    ]);

    const d = await findDuplicateMemberNumbers("evt", ["123", "123"]);

    expect(d).toEqual(["123"]);
    expect(prisma.registration.findMany).toHaveBeenCalledWith({
      where: { eventId: "evt", claimedMemberNumber: { in: ["123"] } },
      select: { claimedMemberNumber: true },
    });
  });
});
