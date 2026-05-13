import { describe, expect, it } from "vitest";
import { formatIdrShort } from "./format-idr-short";

describe("formatIdrShort", () => {
  it("formats thousands as K", () => {
    expect(formatIdrShort(150_000)).toBe("Rp 150K");
    expect(formatIdrShort(75_000)).toBe("Rp 75K");
    expect(formatIdrShort(1_000)).toBe("Rp 1K");
  });

  it("formats millions as jt with Indonesian decimal comma", () => {
    expect(formatIdrShort(1_000_000)).toBe("Rp 1jt");
    expect(formatIdrShort(1_500_000)).toBe("Rp 1,5jt");
    expect(formatIdrShort(10_000_000)).toBe("Rp 10jt");
    expect(formatIdrShort(2_750_000)).toBe("Rp 2,8jt");
  });

  it("formats sub-thousand amounts as plain Rp", () => {
    expect(formatIdrShort(500)).toBe("Rp 500");
    expect(formatIdrShort(0)).toBe("Rp 0");
  });
});
