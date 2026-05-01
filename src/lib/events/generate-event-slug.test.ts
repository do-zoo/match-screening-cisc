import { describe, expect, it } from "vitest";

import { slugifyEventTitle } from "@/lib/events/generate-event-slug";

describe("slugifyEventTitle", () => {
  it("strips punctuation and trims hyphens", () => {
    expect(slugifyEventTitle("  Final — UCL! 2026  ")).toBe("final-ucl-2026");
  });

  it("handles empty input", () => {
    expect(slugifyEventTitle("   ")).toBe("");
  });

  it("removes accented characters", () => {
    expect(slugifyEventTitle("café nöbär")).toBe("cafe-nobar");
  });
});
