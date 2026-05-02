import { describe, expect, it } from "vitest";

import { parseMasterMemberCsvText } from "./parse-master-member-csv-text";

describe("parseMasterMemberCsvText", () => {
  it("parses data rows with physical line numbers", () => {
    const result = parseMasterMemberCsvText(
      [
        "member_number,full_name,whatsapp,is_active,is_management_member",
        "001,Alice,628111111111,true,false",
        "002,Bob,628222222222,true,true",
      ].join("\n"),
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.lineNumberPhysical).toBe(2);
    expect(result.rows[0]?.cells.member_number).toBe("001");
    expect(result.rows[1]?.lineNumberPhysical).toBe(3);
    expect(result.rows[1]?.cells.member_number).toBe("002");
  });

  it("throws when a required column is absent from the header", () => {
    expect(() =>
      parseMasterMemberCsvText(
        [
          "member_number,whatsapp,is_active,is_management_member",
          "001,628111111111,true,false",
        ].join("\n"),
      ),
    ).toThrow('Kolom CSV wajib tidak ada: "full_name".');
  });

  it("throws when there are no data rows after the header", () => {
    expect(() =>
      parseMasterMemberCsvText(
        "member_number,full_name,whatsapp,is_active,is_management_member\n",
      ),
    ).toThrow("Tidak ada baris data setelah header.");
  });

  it("accepts legacy is_pengurus header and maps rows to is_management_member cells", () => {
    const result = parseMasterMemberCsvText(
      [
        "member_number,full_name,whatsapp,is_active,is_pengurus",
        "001,Alice,628111111111,true,false,true",
      ].join("\n"),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.cells.is_management_member).toBe("false");
  });
});
