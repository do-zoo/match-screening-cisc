import { describe, expect, it } from "vitest";

import { sanitizeAuditMetadata } from "./sanitize-audit-metadata";

describe("sanitizeAuditMetadata", () => {
  it("returns null for undefined", () => {
    expect(sanitizeAuditMetadata(undefined)).toBeNull();
  });

  it("allows shallow string/number/boolean records", () => {
    expect(
      sanitizeAuditMetadata({ a: "x", n: 1, ok: true }),
    ).toEqual({ a: "x", n: 1, ok: true });
  });

  it("strips nested objects beyond depth 1 into string placeholder", () => {
    const out = sanitizeAuditMetadata({ outer: { inner: 1 } } as Record<
      string,
      unknown
    >);
    expect(out).toEqual({ outer: "[nested]" });
  });

  it("truncates long string values", () => {
    const long = "a".repeat(500);
    const out = sanitizeAuditMetadata({ k: long });
    expect(String(out?.k).length).toBeLessThanOrEqual(205);
    expect(String(out?.k)).toContain("...");
  });
});
