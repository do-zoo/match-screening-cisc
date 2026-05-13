import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { submitRegistration } from "../submit-registration";

describe("submitRegistration (integrasi ringan / tanpa DB nyata)", () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findFirst).mockReset();
  });

  it("mengembalikan field error jika slug kosong", async () => {
    const r = await submitRegistration(null, new FormData());
    expect(r.ok).toBe(false);
    if (!r.ok && "fieldErrors" in r && r.fieldErrors) {
      expect(r.fieldErrors.slug).toBeDefined();
    }
  });

  it("mengembalikan error jika acara tidak ditemukan", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("slug", "tidak-ada");
    const r = await submitRegistration(null, fd);
    expect(r.ok).toBe(false);
    if (!r.ok && "rootError" in r) {
      expect(r.rootError).toBeTruthy();
    }
  });
});
