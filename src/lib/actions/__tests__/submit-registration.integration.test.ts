import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    registration: { count: vi.fn() },
  },
}));

vi.mock("@/lib/public/load-club-operational-settings", () => ({
  loadClubOperationalSettings: vi.fn().mockResolvedValue({
    registrationGloballyDisabled: false,
    globalRegistrationClosedMessage: null,
  }),
}));

import { prisma } from "@/lib/db/prisma";
import { submitRegistration } from "../submit-registration";

describe("submitRegistration (integrasi ringan / tanpa DB nyata)", () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findUnique).mockReset();
  });

  it("mengembalikan error jika holders JSON tidak valid", async () => {
    const fd = new FormData();
    fd.set("holders", "bukan-json");
    const r = await submitRegistration("event-123", fd);
    expect(r.ok).toBe(false);
    if (!r.ok && "rootError" in r) {
      expect(r.rootError).toBeTruthy();
    }
  });

  it("mengembalikan error jika acara tidak ditemukan", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("ticketCategoryId", "cat-1");
    fd.set("ticketQty", "1");
    fd.set("holders", JSON.stringify([{ holderName: "Tester" }]));
    fd.set("contactWhatsapp", "08123456789");
    fd.set(
      "transferProof",
      new File([new Uint8Array([1])], "proof.jpg", { type: "image/jpeg" }),
    );
    const r = await submitRegistration("tidak-ada", fd);
    expect(r.ok).toBe(false);
    if (!r.ok && "rootError" in r) {
      expect(r.rootError).toBeTruthy();
    }
  });
});
