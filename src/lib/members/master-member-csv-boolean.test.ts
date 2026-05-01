import { describe, expect, it } from "vitest";

import { interpretMasterMemberCsvBoolean } from "./master-member-csv-boolean";

describe("interpretMasterMemberCsvBoolean", () => {
  it("returns undefined for undefined, null, empty, whitespace", () => {
    expect(interpretMasterMemberCsvBoolean(undefined)).toBeUndefined();
    expect(interpretMasterMemberCsvBoolean(null)).toBeUndefined();
    expect(interpretMasterMemberCsvBoolean("")).toBeUndefined();
    expect(interpretMasterMemberCsvBoolean("   ")).toBeUndefined();
  });

  it("parses true tokens case-insensitively", () => {
    for (const t of ["true", "TRUE", "1", "yes", "Y", "iya", "IyA"]) {
      expect(interpretMasterMemberCsvBoolean(t), t).toBe(true);
    }
  });

  it("parses false tokens case-insensitively", () => {
    for (const t of ["false", "FALSE", "0", "no", "N", "tidak", "Tidak"]) {
      expect(interpretMasterMemberCsvBoolean(t), t).toBe(false);
    }
  });

  it("returns undefined for unknown text (partial update semantics)", () => {
    expect(interpretMasterMemberCsvBoolean("maybe")).toBeUndefined();
  });
});
