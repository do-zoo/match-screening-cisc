import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adminProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    masterMember: { findUnique: vi.fn() },
    event: { count: vi.fn() },
    picBankAccount: { count: vi.fn() },
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
  deleteCommitteeAdmin,
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

describe("deleteCommitteeAdmin", () => {
  beforeEach(() => {
    vi.mocked(prisma.adminProfile.findMany).mockReset();
    vi.mocked(prisma.adminProfile.findUnique).mockReset();
    vi.mocked(prisma.adminProfile.delete).mockReset();
    vi.mocked(prisma.event.count).mockReset();
    vi.mocked(prisma.picBankAccount.count).mockReset();
    vi.mocked(prisma.event.count).mockResolvedValue(0);
    vi.mocked(prisma.picBankAccount.count).mockResolvedValue(0);
  });

  it("returns root error when profile not found", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("adminProfileId", "nonexistent");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("tidak ditemukan");
  });

  it("blocks deleting own profile", async () => {
    // guardOwner mock returns authUserId: "actor_user" — match it in target
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p_self",
      authUserId: "actor_user",
      role: AdminRole.Admin,
    } as never);
    const fd = new FormData();
    fd.set("adminProfileId", "p_self");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("sendiri");
  });

  it("blocks delete when profile is primary PIC on events", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p_pic",
      authUserId: "u_pic",
      role: AdminRole.Admin,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "actor_user" },
    ] as never);
    vi.mocked(prisma.event.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.picBankAccount.count).mockResolvedValueOnce(0);

    const fd = new FormData();
    fd.set("adminProfileId", "p_pic");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("PIC");
    expect(vi.mocked(prisma.adminProfile.delete)).not.toHaveBeenCalled();
  });

  it("blocks deleting sole Owner", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p_owner",
      authUserId: "other_owner",
      role: AdminRole.Owner,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "other_owner" },
    ] as never);
    const fd = new FormData();
    fd.set("adminProfileId", "p_owner");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("Owner");
  });

  it("deletes profile when target is non-Owner non-self", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p_viewer",
      authUserId: "other_viewer",
      role: AdminRole.Viewer,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "actor_user" },
    ] as never);
    vi.mocked(prisma.adminProfile.delete).mockResolvedValueOnce({} as never);
    const fd = new FormData();
    fd.set("adminProfileId", "p_viewer");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(true);
    expect(vi.mocked(prisma.adminProfile.delete)).toHaveBeenCalledWith({
      where: { id: "p_viewer" },
    });
  });

  it("deletes Owner profile when another Owner exists", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p_owner2",
      authUserId: "second_owner",
      role: AdminRole.Owner,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "actor_user" },
      { authUserId: "second_owner" },
    ] as never);
    vi.mocked(prisma.adminProfile.delete).mockResolvedValueOnce({} as never);
    const fd = new FormData();
    fd.set("adminProfileId", "p_owner2");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(true);
  });
});
