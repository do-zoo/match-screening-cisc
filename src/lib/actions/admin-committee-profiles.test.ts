import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adminProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    masterMember: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/actions/guard", () => ({
  guardOwner: vi.fn().mockResolvedValue({
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

import { prisma } from "@/lib/db/prisma";
import { AdminRole } from "@prisma/client";
import {
  addCommitteeAdminByEmail,
  revokeCommitteeAdminMeaningfulAccess,
  updateCommitteeAdminRole,
} from "@/lib/actions/admin-committee-profiles";

describe("addCommitteeAdminByEmail", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findFirst).mockReset();
    vi.mocked(prisma.adminProfile.findUnique).mockReset();
    vi.mocked(prisma.adminProfile.create).mockReset();
  });

  it("returns root error when user missing", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("email", "nobody@example.com");
    const r = await addCommitteeAdminByEmail(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("email");
  });

  it("creates Viewer profile when user exists without profile", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: "u_new" } as never);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.adminProfile.create).mockResolvedValueOnce({
      id: "prof_new",
    } as never);
    const fd = new FormData();
    fd.set("email", "new@example.com");
    const r = await addCommitteeAdminByEmail(undefined, fd);
    expect(r.ok).toBe(true);
  });
});

describe("updateCommitteeAdminRole / revoke", () => {
  beforeEach(() => {
    vi.mocked(prisma.adminProfile.findMany).mockReset();
    vi.mocked(prisma.adminProfile.findUnique).mockReset();
    vi.mocked(prisma.adminProfile.update).mockReset();
  });

  it("blocks demoting sole Owner", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p1",
      authUserId: "only_owner",
      role: AdminRole.Owner,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "only_owner" },
    ] as never);

    const fd = new FormData();
    fd.set("adminProfileId", "p1");
    fd.set("role", "Admin");
    const r = await updateCommitteeAdminRole(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("Owner");
  });

  it("allows demoting Owner when another exists", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p1",
      authUserId: "o1",
      role: AdminRole.Owner,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "o1" },
      { authUserId: "o2" },
    ] as never);

    const fd = new FormData();
    fd.set("adminProfileId", "p1");
    fd.set("role", "Admin");
    const r = await updateCommitteeAdminRole(undefined, fd);
    expect(r.ok).toBe(true);
  });

  it("blocks revoke on sole Owner", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p1",
      authUserId: "only_owner",
      role: AdminRole.Owner,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "only_owner" },
    ] as never);

    const fd = new FormData();
    fd.set("adminProfileId", "p1");
    const r = await revokeCommitteeAdminMeaningfulAccess(undefined, fd);
    expect(r.ok).toBe(false);
  });
});
