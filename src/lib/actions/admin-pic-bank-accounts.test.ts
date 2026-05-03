import { describe, expect, it, vi, beforeEach } from "vitest";

import { AdminRole } from "@prisma/client";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    picBankAccount: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    event: { count: vi.fn() },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/auth/admin-context", () => ({
  getAdminContext: vi.fn(),
}));

vi.mock("@/lib/audit/append-club-audit-log", () => ({
  appendClubAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import {
  createPicBankAccount,
  deletePicBankAccountPermanent,
} from "@/lib/actions/admin-pic-bank-accounts";

describe("admin-pic-bank-accounts mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects Viewer create", async () => {
    vi.mocked(requireAdminSession).mockResolvedValueOnce({
      user: { id: "u-view" },
    } as never);
    vi.mocked(getAdminContext).mockResolvedValueOnce({
      profileId: "p-view",
      role: AdminRole.Viewer,
      helperEventIds: [],
    });

    const fd = new FormData();
    fd.set("ownerAdminProfileId", "p-view");
    fd.set("bankName", "BCA");
    fd.set("accountNumber", "123");
    fd.set("accountName", "X");

    const r = await createPicBankAccount(undefined, fd);
    expect(r.ok).toBe(false);
    expect(vi.mocked(prisma.picBankAccount.create)).not.toHaveBeenCalled();
  });

  it("rejects Verifier creating bank for someone else profile", async () => {
    vi.mocked(requireAdminSession).mockResolvedValueOnce({
      user: { id: "u-v" },
    } as never);
    vi.mocked(getAdminContext).mockResolvedValueOnce({
      profileId: "self",
      role: AdminRole.Verifier,
      helperEventIds: [],
    });

    const fd = new FormData();
    fd.set("ownerAdminProfileId", "other");
    fd.set("bankName", "BCA");
    fd.set("accountNumber", "123");
    fd.set("accountName", "X");

    const r = await createPicBankAccount(undefined, fd);
    expect(r.ok).toBe(false);
    expect(vi.mocked(prisma.picBankAccount.create)).not.toHaveBeenCalled();
  });

  it("delete fails when referenced by events", async () => {
    vi.mocked(requireAdminSession).mockResolvedValueOnce({
      user: { id: "u-o" },
    } as never);
    vi.mocked(getAdminContext).mockResolvedValueOnce({
      profileId: "owner-p",
      role: AdminRole.Owner,
      helperEventIds: [],
    });
    vi.mocked(prisma.event.count).mockResolvedValueOnce(1);

    const fd = new FormData();
    fd.set("ownerAdminProfileId", "target-p");
    fd.set("bankAccountId", "bank-1");

    const r = await deletePicBankAccountPermanent(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError ?? "").toMatch(/masih dipakai/);
    expect(vi.mocked(prisma.picBankAccount.delete)).not.toHaveBeenCalled();
  });
});
