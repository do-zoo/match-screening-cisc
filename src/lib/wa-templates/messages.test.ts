import { describe, expect, it } from "vitest";
import { templateReceipt } from "@/lib/wa-templates/messages";
import { normalizeIdPhone, waMeLink } from "@/lib/wa-templates/encode";

describe("wa templates", () => {
  it("normalizes ID domestic and trims stray leading 0 before 62", () => {
    expect(normalizeIdPhone("081234567890")).toBe("6281234567890");
    expect(normalizeIdPhone("+62 812-3456-7890")).toBe("6281234567890");
    expect(normalizeIdPhone("06281234567890")).toBe("6281234567890");
  });

  it("builds wa.me with encoded text", () => {
    const url = waMeLink("081234567890", "Halo & test");
    expect(url).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(decodeURIComponent(url.split("text=")[1]!)).toBe("Halo & test");
  });

  it("includes registration id in receipt", () => {
    const body = templateReceipt({
      contactName: "A",
      eventTitle: "Final UCL",
      registrationId: "reg_1",
      computedTotalIdr: 250000,
    });
    expect(body).toContain("reg_1");
    expect(body).toContain("menunggu verifikasi");
  });
});
