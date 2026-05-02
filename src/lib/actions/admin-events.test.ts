import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
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
  guardEvent: vi.fn(),
}));

vi.mock("@/lib/audit/append-club-audit-log", () => ({
  appendClubAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@vercel/blob", () => ({
  del: vi.fn().mockResolvedValue(undefined),
  put: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Stub heavy deps not under test
vi.mock("@/lib/events/generate-event-slug", () => ({
  allocateUniqueEventSlug: vi.fn(),
}));
vi.mock("@/lib/events/event-admin-defaults", () => ({
  resolveCommitteeTicketDefaults: vi.fn(),
}));
vi.mock("@/lib/public/sanitize-event-description", () => ({
  sanitizePublicEventDescriptionHtml: vi.fn((s: string) => s),
}));

import { del } from "@vercel/blob";
import { prisma } from "@/lib/db/prisma";
import { deleteAdminEvent } from "@/lib/actions/admin-events";

describe("deleteAdminEvent", () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findUnique).mockReset();
    vi.mocked(prisma.event.delete).mockReset();
    vi.mocked(del).mockReset();
    vi.mocked(del).mockResolvedValue(undefined as never);
  });

  it("returns root error when event not found", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("eventId", "nonexistent");
    const r = await deleteAdminEvent(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("tidak ditemukan");
  });

  it("returns root error when event has registrations", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce({
      id: "ev1",
      title: "Test Event",
      coverBlobUrl: "https://blob/cover.webp",
      _count: { registrations: 3 },
    } as never);
    const fd = new FormData();
    fd.set("eventId", "ev1");
    const r = await deleteAdminEvent(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("3");
  });

  it("deletes event and blob when no registrations", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce({
      id: "ev2",
      title: "Draft Event",
      coverBlobUrl: "https://blob/cover2.webp",
      _count: { registrations: 0 },
    } as never);
    vi.mocked(prisma.event.delete).mockResolvedValueOnce({} as never);
    const fd = new FormData();
    fd.set("eventId", "ev2");
    const r = await deleteAdminEvent(undefined, fd);
    expect(r.ok).toBe(true);
    expect(vi.mocked(prisma.event.delete)).toHaveBeenCalledWith({
      where: { id: "ev2" },
    });
    expect(vi.mocked(del)).toHaveBeenCalledWith("https://blob/cover2.webp");
  });

  it("returns root error when eventId is empty", async () => {
    const fd = new FormData();
    fd.set("eventId", "  ");
    const r = await deleteAdminEvent(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("tidak valid");
  });
});
