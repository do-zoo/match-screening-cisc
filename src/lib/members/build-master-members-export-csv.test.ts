import { describe, expect, it } from "vitest";

import { buildMasterMembersExportCsv } from "./build-master-members-export-csv";

describe("buildMasterMembersExportCsv", () => {
  it("writes BOM header and booleans compatible with importer", () => {
    const csv = buildMasterMembersExportCsv([
      {
        id: "1",
        memberNumber: "M-01",
        fullName: "A",
        whatsapp: null,
        isActive: true,
        isManagementMember: false,
        updatedAt: "",
      },
    ]);
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain("member_number");
    expect(csv).toContain("M-01");
    expect(csv).toContain("true");
    expect(csv).toContain("false");
  });

  it("empty whatsapp renders as empty quotes or empty column per Papa rules", () => {
    const csv = buildMasterMembersExportCsv([
      {
        id: "1",
        memberNumber: "X",
        fullName: "Y",
        whatsapp: null,
        isActive: false,
        isManagementMember: false,
        updatedAt: "",
      },
    ]);
    expect(csv).toContain("X");
    expect(csv).toContain("Y");
  });
});
