import { describe, expect, it } from "vitest";
import { templateReceipt } from "@/lib/wa-templates/messages";
import { normalizeIdPhone, waMeLink } from "@/lib/wa-templates/encode";
import {
  templateCancelled,
  templateRefunded,
  templateUnderpaymentInvoice,
} from "@/lib/wa-templates/messages";

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

describe("additional wa templates", () => {
  it("templateCancelled mentions event title and contact name", () => {
    const body = templateCancelled("Budi", "Demo Final");
    expect(body).toContain("Budi");
    expect(body).toContain("Demo Final");
    expect(body).toContain("dibatalkan");
  });

  it("templateRefunded mentions event title", () => {
    const body = templateRefunded("Sari", "Demo Final");
    expect(body).toContain("Demo Final");
    expect(body).toContain("dikembalikan");
  });

  it("templateUnderpaymentInvoice includes amount and bank details", () => {
    const body = templateUnderpaymentInvoice({
      contactName: "Andi",
      eventTitle: "Final UCL",
      adjustmentAmountIdr: 50_000,
      bankName: "BCA",
      accountNumber: "1234567890",
      accountName: "Demo CISC",
    });
    expect(body).toContain("50.000");
    expect(body).toContain("BCA");
    expect(body).toContain("1234567890");
  });
});
