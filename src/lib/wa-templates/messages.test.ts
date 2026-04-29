import { describe, expect, it } from "vitest";
import { templateReceipt } from "@/lib/wa-templates/messages";
import { waMeLink } from "@/lib/wa-templates/encode";

describe("wa templates", () => {
  it("builds wa.me with encoded text", () => {
    const url = waMeLink("081234567890", "Halo & test");
    expect(url).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Halo & test");
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
