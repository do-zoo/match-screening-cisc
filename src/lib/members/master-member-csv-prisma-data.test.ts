import { describe, expect, it } from "vitest";

import {
  masterMemberCsvPatchToCreateData,
  masterMemberCsvPatchToUpdateData,
} from "./master-member-csv-prisma-data";

describe("masterMemberCsvPatchToUpdateData", () => {
  it("returns empty Prisma fragment for empty patch", () => {
    expect(masterMemberCsvPatchToUpdateData({})).toEqual({});
  });

  it("maps only defined scalar keys", () => {
    expect(
      masterMemberCsvPatchToUpdateData({
        fullName: "A",
        whatsapp: null,
      }),
    ).toEqual({ fullName: "A", whatsapp: null });
  });
});

describe("masterMemberCsvPatchToCreateData", () => {
  it("throws if full name missing", () => {
    expect(() => masterMemberCsvPatchToCreateData({}, "MN-01")).toThrow(
      /INTERNAL/,
    );
  });

  it("trim fullName and merges optional booleans", () => {
    expect(
      masterMemberCsvPatchToCreateData(
        { fullName: "  X ", isActive: true },
        "MN-01",
      ),
    ).toEqual({
      memberNumber: "MN-01",
      fullName: "X",
      whatsapp: null,
      isActive: true,
    });
  });
});
