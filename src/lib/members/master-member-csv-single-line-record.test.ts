import { describe, expect, it } from "vitest";

import { assertCsvTextSingleLinePhysicalRecords } from "./master-member-csv-single-line-record";

describe("assertCsvTextSingleLinePhysicalRecords", () => {
  it("allows simple one-line records", () => {
    expect(() =>
      assertCsvTextSingleLinePhysicalRecords(
        "member_number,full_name\n001,Alice\n002,Bob\n",
      ),
    ).not.toThrow();
  });

  it("throws when a quoted field spans a newline", () => {
    expect(() =>
      assertCsvTextSingleLinePhysicalRecords(
        'member_number,full_name\n001,"Line1\nLine2"\n',
      ),
    ).toThrow(/multiline tidak didukung/i);
  });
});
