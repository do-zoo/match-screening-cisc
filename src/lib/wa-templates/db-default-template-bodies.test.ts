import { WaTemplateKey } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { CLUB_WA_DEFAULT_BODIES } from "@/lib/wa-templates/db-default-template-bodies";
import { validateWaTemplateBody } from "@/lib/wa-templates/wa-template-policy";

describe("CLUB_WA_DEFAULT_BODIES validity", () => {
  const allKeys = (
    Object.values(WaTemplateKey) as WaTemplateKey[]
  ).filter((v) => typeof v === "string") as WaTemplateKey[];

  it.each(allKeys)("defaults valid for %s", (key) => {
    expect(
      validateWaTemplateBody(key, CLUB_WA_DEFAULT_BODIES[key]),
    ).toBeNull();
  });

  it("covers every prisma WaTemplateKey string value", () => {
    expect(new Set(allKeys)).toEqual(new Set(Object.keys(CLUB_WA_DEFAULT_BODIES)));
  });
});
