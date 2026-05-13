import { describe, expect, it } from "vitest";

import { parseIdrDigitsToInt } from "./idr-input";

describe("parseIdrDigitsToInt", () => {
  it("returns 0 for empty or non-digit", () => {
    expect(parseIdrDigitsToInt("")).toBe(0);
    expect(parseIdrDigitsToInt("abc")).toBe(0);
  });

  it("strips grouping and currency noise", () => {
    expect(parseIdrDigitsToInt("Rp 125.000")).toBe(125_000);
    expect(parseIdrDigitsToInt("1.250.000")).toBe(1_250_000);
  });

  it("parses plain digits", () => {
    expect(parseIdrDigitsToInt("50000")).toBe(50_000);
  });
});
