import { describe, expect, it } from "vitest";

import { labelForOptionValue } from "./entity-combobox-label";

describe("labelForOptionValue", () => {
  const opts = [
    { value: "a", label: "Satu" },
    { value: "b", label: "Dua", keywords: "alias" },
  ];

  it("returns null when value is null", () => {
    expect(labelForOptionValue(opts, null)).toBeNull();
  });

  it("returns label for known value", () => {
    expect(labelForOptionValue(opts, "a")).toBe("Satu");
  });

  it("returns null for unknown value so UI can show placeholder not raw id", () => {
    expect(labelForOptionValue(opts, "unknown-uuid")).toBeNull();
  });
});
