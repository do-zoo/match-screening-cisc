import { WaTemplateKey } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  REQUIRED_TOKENS,
  validateWaTemplateBody,
} from "@/lib/wa-templates/wa-template-policy";

describe("validateWaTemplateBody", () => {
  it("accepts minimal receipt layout", () => {
    expect(
      validateWaTemplateBody(
        WaTemplateKey.receipt,
        [
          "Halo {contact_name}!",
          "{event_title} #{registration_id} total {computed_total_idr}",
        ].join("\n"),
      ),
    ).toBeNull();
  });

  it("rejects missing required token", () => {
    const err = validateWaTemplateBody(
      WaTemplateKey.receipt,
      "Halo {contact_name}",
    );
    expect(err).toMatch(/wajib|registration_id/i);
  });

  it("lists known keys map", () => {
    expect(Object.keys(REQUIRED_TOKENS)).toContain("underpayment_invoice");
  });
});
