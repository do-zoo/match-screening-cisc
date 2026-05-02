import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    masterMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/actions/guard", () => ({
  guardOwner: vi.fn().mockResolvedValue({
    profileId: "actor_prof",
    role: "Owner",
    helperEventIds: [],
    authUserId: "actor_user",
  }),
  guardOwnerOrAdmin: vi.fn().mockResolvedValue({
    profileId: "actor_prof",
    role: "Owner",
    helperEventIds: [],
    authUserId: "actor_user",
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/audit/append-club-audit-log", () => ({
  appendClubAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Stub CSV parser dependency
vi.mock("papaparse", () => ({ default: { parse: vi.fn() } }));

import { prisma } from "@/lib/db/prisma";
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { deleteMasterMember } from "@/lib/actions/admin-master-members";

describe("deleteMasterMember", () => {
  beforeEach(() => {
    vi.mocked(prisma.masterMember.findUnique).mockReset();
    vi.mocked(prisma.masterMember.delete).mockReset();
    vi.mocked(appendClubAuditLog).mockReset();
  });

  it("returns root error when member not found", async () => {
    vi.mocked(prisma.masterMember.findUnique).mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("memberId", "nonexistent");
    const r = await deleteMasterMember(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("tidak ditemukan");
  });

  it("blocks deletion when member is PIC of events", async () => {
    vi.mocked(prisma.masterMember.findUnique).mockResolvedValueOnce({
      id: "m1",
      fullName: "Budi",
      memberNumber: "001",
      _count: { eventsAsPicMaster: 2, bankAccounts: 0 },
    } as never);
    const fd = new FormData();
    fd.set("memberId", "m1");
    const r = await deleteMasterMember(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("PIC");
  });

  it("blocks deletion when member has bank accounts", async () => {
    vi.mocked(prisma.masterMember.findUnique).mockResolvedValueOnce({
      id: "m2",
      fullName: "Sari",
      memberNumber: "002",
      _count: { eventsAsPicMaster: 0, bankAccounts: 1 },
    } as never);
    const fd = new FormData();
    fd.set("memberId", "m2");
    const r = await deleteMasterMember(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("rekening");
  });

  it("deletes member when no blocking constraints", async () => {
    vi.mocked(prisma.masterMember.findUnique).mockResolvedValueOnce({
      id: "m3",
      fullName: "Andi",
      memberNumber: "003",
      _count: { eventsAsPicMaster: 0, bankAccounts: 0 },
    } as never);
    vi.mocked(prisma.masterMember.delete).mockResolvedValueOnce({} as never);
    const fd = new FormData();
    fd.set("memberId", "m3");
    const r = await deleteMasterMember(undefined, fd);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ deleted: true });
    expect(vi.mocked(prisma.masterMember.delete)).toHaveBeenCalledWith({
      where: { id: "m3" },
    });
  });
});
