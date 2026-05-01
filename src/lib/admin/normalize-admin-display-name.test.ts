import { describe, expect, it } from "vitest";

import { normalizeAdminDisplayName } from "./normalize-admin-display-name";

describe("normalizeAdminDisplayName", () => {
  it("rejects empty after trim", () => {
    expect(normalizeAdminDisplayName("   ")).toEqual({
      ok: false,
      message: "Nama wajib diisi.",
    });
  });

  it("rejects longer than 120", () => {
    const s = "a".repeat(121);
    const r = normalizeAdminDisplayName(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/120/);
  });

  it("accepts trim and max length", () => {
    expect(normalizeAdminDisplayName("  Ada Nama  ")).toEqual({
      ok: true,
      value: "Ada Nama",
    });
    const max = "x".repeat(120);
    expect(normalizeAdminDisplayName(max)).toEqual({ ok: true, value: max });
  });
});
