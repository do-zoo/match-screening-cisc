import { describe, expect, it, vi, beforeEach } from "vitest";
import { EventStatus } from "@prisma/client";

const txEventCreate = vi.fn();
const txEventVenueMenuItemCreateMany = vi.fn();
const txEventPicHelperCreateMany = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        event: { create: txEventCreate },
        eventVenueMenuItem: { createMany: txEventVenueMenuItemCreateMany },
        eventPicHelper: { createMany: txEventPicHelperCreateMany },
      }),
    ),
    event: {
      findUnique: vi.fn(),
    },
    adminProfile: {
      findUnique: vi.fn(),
    },
    picBankAccount: {
      findFirst: vi.fn(),
    },
    venueMenuItem: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/actions/guard", () => ({
  guardOwnerOrAdmin: vi.fn().mockResolvedValue({
    profileId: "actor_prof",
    role: "Owner",
    helperEventIds: [],
    authUserId: "actor_user",
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/events/generate-event-slug", () => ({
  allocateUniqueEventSlug: vi.fn().mockResolvedValue("acara-uji"),
}));

vi.mock("@/lib/uploads/upload-event-cover", () => ({
  uploadEventHeroCover: vi.fn().mockResolvedValue({
    url: "https://blob.example/cover.webp",
    pathname: "events/x/cover.webp",
  }),
}));

vi.mock("@/lib/public/sanitize-event-description", () => ({
  sanitizePublicEventDescriptionHtml: vi.fn((s: string) => s),
}));

import { prisma } from "@/lib/db/prisma";
import { createAdminEvent } from "../admin-events";

describe("createAdminEvent (integrasi dengan mock DB)", () => {
  beforeEach(() => {
    txEventCreate.mockReset();
    txEventVenueMenuItemCreateMany.mockReset();
    txEventPicHelperCreateMany.mockReset();
    vi.mocked(prisma.adminProfile.findUnique).mockReset();
    vi.mocked(prisma.picBankAccount.findFirst).mockReset();
    vi.mocked(prisma.venueMenuItem.findMany).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(prisma.event.findUnique).mockReset();
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb) =>
      cb({
        event: { create: txEventCreate },
        eventVenueMenuItem: { createMany: txEventVenueMenuItemCreateMany },
        eventPicHelper: { createMany: txEventPicHelperCreateMany },
      } as never),
    );

    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValue({
      id: "pic-1",
      role: "Owner",
    } as never);
    vi.mocked(prisma.picBankAccount.findFirst).mockResolvedValue({
      id: "bank-1",
    } as never);
    vi.mocked(prisma.venueMenuItem.findMany).mockResolvedValue([
      { id: "menu-1", venueId: "venue-1" },
    ] as never);
    txEventCreate.mockResolvedValue({} as never);
    txEventVenueMenuItemCreateMany.mockResolvedValue({ count: 1 } as never);
  });

  it("menyimpan timing, mandatoryMenuItemIds, dan harga ke baris Event", async () => {
    const payload = {
      title: "Acara Uji",
      summary: "Ringkasan",
      descriptionHtml: "<p>Isi</p>",
      venueId: "venue-1",
      linkedVenueMenuItems: [{ venueMenuItemId: "menu-1", sortOrder: 0 }],
      openRegistrationAtIso: new Date("2026-06-01T08:00:00.000Z").toISOString(),
      closeRegistrationAtIso: new Date("2026-06-10T12:00:00.000Z").toISOString(),
      openGateAtIso: new Date("2026-06-10T16:00:00.000Z").toISOString(),
      kickOffAtIso: new Date("2026-06-10T19:00:00.000Z").toISOString(),
      mandatoryMenuItemIds: ["menu-1"],
      registrationManualClosed: false,
      status: EventStatus.draft,
      ticketMemberPrice: 500_000,
      ticketNonMemberPrice: 750_000,
      picAdminProfileId: "pic-1",
      bankAccountId: "bank-1",
      helperAdminProfileIds: [],
    };

    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    const cover = new File([new Uint8Array([1, 2, 3])], "cover.png", {
      type: "image/png",
    });
    fd.set("cover", cover);

    const r = await createAdminEvent(undefined, fd);
    expect(r.ok).toBe(true);
    expect(txEventCreate).toHaveBeenCalled();
    const call = txEventCreate.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.mandatoryMenuItemIds).toEqual(["menu-1"]);
    expect(call.data.ticketMemberPrice).toBe(500_000);
    expect(call.data.openRegistrationAt).toEqual(
      new Date("2026-06-01T08:00:00.000Z"),
    );
    expect(txEventVenueMenuItemCreateMany).toHaveBeenCalled();
  });
});
