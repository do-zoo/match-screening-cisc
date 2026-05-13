import { EventStatus, PricingSource } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { adminEventUpsertSchema } from "./admin-event-form-schema";

function validBase() {
  return {
    title: "Acara Uji",
    summary: "Ringkasan singkat.",
    descriptionHtml: "<p>Isi</p>",
    venueId: "venue-1",
    linkedVenueMenuItems: [{ venueMenuItemId: "menu-a", sortOrder: 0 }],
    openRegistrationAtIso: new Date("2026-06-01T08:00:00.000Z").toISOString(),
    closeRegistrationAtIso: new Date("2026-06-10T12:00:00.000Z").toISOString(),
    openGateAtIso: new Date("2026-06-10T16:00:00.000Z").toISOString(),
    kickOffAtIso: new Date("2026-06-10T19:00:00.000Z").toISOString(),
    mandatoryMenuItemIds: ["menu-a"],
    registrationManualClosed: false,
    status: EventStatus.draft,
    pricingSource: PricingSource.overridden,
    ticketMemberPrice: 500_000,
    ticketNonMemberPrice: 750_000,
    picAdminProfileId: "pic-1",
    bankAccountId: "bank-1",
    helperAdminProfileIds: [] as string[],
  };
}

describe("adminEventUpsertSchema", () => {
  it("accepts valid timing, pricing, and mandatory menu subset", () => {
    const r = adminEventUpsertSchema.safeParse(validBase());
    expect(r.success).toBe(true);
  });

  it("rejects when tutup registrasi tidak setelah buka", () => {
    const r = adminEventUpsertSchema.safeParse({
      ...validBase(),
      openRegistrationAtIso: new Date("2026-06-10T12:00:00.000Z").toISOString(),
      closeRegistrationAtIso: new Date("2026-06-01T08:00:00.000Z").toISOString(),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("closeRegistrationAtIso");
    }
  });

  it("rejects when kick-off tidak setelah buka gate", () => {
    const r = adminEventUpsertSchema.safeParse({
      ...validBase(),
      openGateAtIso: new Date("2026-06-10T20:00:00.000Z").toISOString(),
      kickOffAtIso: new Date("2026-06-10T16:00:00.000Z").toISOString(),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("kickOffAtIso");
    }
  });

  it("rejects menu wajib yang bukan subset linkedVenueMenuItems", () => {
    const r = adminEventUpsertSchema.safeParse({
      ...validBase(),
      mandatoryMenuItemIds: ["menu-lain"],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.startsWith("mandatoryMenuItemIds"))).toBe(
        true,
      );
    }
  });

  it("rejects harga tiket member 0", () => {
    const r = adminEventUpsertSchema.safeParse({
      ...validBase(),
      ticketMemberPrice: 0,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.path[0] === "ticketMemberPrice"),
      ).toBe(true);
    }
  });
});
