import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    adminProfile: { findUnique: vi.fn() },
  },
}));

describe("assertAdminMagicLinkEmail", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("throws when user does not exist", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { assertAdminMagicLinkEmail } = await import(
      "@/lib/auth/assert-admin-magic-link-email"
    );
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    await expect(assertAdminMagicLinkEmail("x@y.com")).rejects.toMatchObject({
      message: expect.stringContaining("tidak terdaftar"),
    });
    expect(prisma.adminProfile.findUnique).not.toHaveBeenCalled();
  });

  it("throws when user exists but has no AdminProfile", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { assertAdminMagicLinkEmail } = await import(
      "@/lib/auth/assert-admin-magic-link-email"
    );
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1" } as Awaited<
      ReturnType<(typeof prisma)["user"]["findFirst"]>
    >);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue(null);

    await expect(assertAdminMagicLinkEmail("x@y.com")).rejects.toMatchObject({
      message: expect.stringContaining("tidak terdaftar"),
    });
  });

  it("resolves when user and AdminProfile exist", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { assertAdminMagicLinkEmail } = await import(
      "@/lib/auth/assert-admin-magic-link-email"
    );
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1" } as Awaited<
      ReturnType<(typeof prisma)["user"]["findFirst"]>
    >);
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({ id: "a1" } as Awaited<
      ReturnType<(typeof prisma)["adminProfile"]["findUnique"]>
    >);

    await expect(assertAdminMagicLinkEmail("x@y.com")).resolves.toBeUndefined();
  });
});
