import { describe, expect, it, vi, beforeEach } from "vitest";

import { AdminRole } from "@prisma/client";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    adminProfile: { findUnique: vi.fn() },
    adminInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
  isAuthError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/audit/append-club-audit-log", () => ({
  appendClubAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/send-transactional-email", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/emails/render-emails", () => ({
  renderAdminInviteEmail: vi.fn().mockResolvedValue("<p>x</p>"),
}));

vi.mock("@/lib/auth/transactional-email-config", () => ({
  isTransactionalEmailConfigured: vi.fn(() => false),
}));

vi.mock("@/lib/admin/build-admin-invite-url", () => ({
  buildAdminInviteAcceptUrl: vi.fn(() => "http://localhost:3000/admin/invite/RAW"),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import {
  createAdminInvitation,
  revokeAdminInvitation,
} from "@/lib/actions/admin-admin-invitations";

describe("createAdminInvitation", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findFirst).mockReset();
    vi.mocked(prisma.adminProfile.findUnique).mockReset();
    vi.mocked(prisma.adminInvitation.findFirst).mockReset();
    vi.mocked(prisma.adminInvitation.create).mockReset();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.adminInvitation.create).mockResolvedValue({
      id: "inv_new",
    } as never);
  });

  it("rejects when user exists without admin profile", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: "u1" } as never);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce(null);

    const fd = new FormData();
    fd.set("email", "x@example.com");
    fd.set("role", AdminRole.Verifier);
    const r = await createAdminInvitation(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError ?? "").toMatch(/gunakan email lain|operator/i);
    expect(prisma.adminInvitation.create).not.toHaveBeenCalled();
  });

  it("rejects when an active invitation already exists", async () => {
    vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValueOnce({
      id: "existing",
    } as never);

    const fd = new FormData();
    fd.set("email", "new@example.com");
    fd.set("role", AdminRole.Viewer);
    const r = await createAdminInvitation(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError ?? "").toContain("undangan aktif");
    expect(prisma.adminInvitation.create).not.toHaveBeenCalled();
  });

  it("creates invitation when checks pass", async () => {
    const fd = new FormData();
    fd.set("email", "fresh@example.com");
    fd.set("role", AdminRole.Admin);
    const r = await createAdminInvitation(undefined, fd);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.created).toBe(true);
    expect(vi.mocked(prisma.adminInvitation.create)).toHaveBeenCalled();
  });
});

describe("revokeAdminInvitation", () => {
  beforeEach(() => {
    vi.mocked(prisma.adminInvitation.findUnique).mockReset();
    vi.mocked(prisma.adminInvitation.update).mockReset();
  });

  it("blocks when consumed", async () => {
    vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValueOnce({
      id: "inv1",
      emailNormalized: "a@b.com",
      consumedAt: new Date(),
      revokedAt: null,
    } as never);

    const fd = new FormData();
    fd.set("invitationId", "inv1");
    const r = await revokeAdminInvitation(undefined, fd);
    expect(r.ok).toBe(false);
    expect(prisma.adminInvitation.update).not.toHaveBeenCalled();
  });
});
