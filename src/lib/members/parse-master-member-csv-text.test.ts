import { describe, expect, it } from "vitest";

import { parseMasterMemberCsvText } from "./parse-master-member-csv-text";

describe("parseMasterMemberCsvText", () => {
  it("parses data rows with physical line numbers", () => {
    const result = parseMasterMemberCsvText(
      [
        "member_number,full_name,whatsapp,is_active,is_pengurus,can_be_pic",
        "001,Alice,628111111111,true,false,true",
        "002,Bob,628222222222,true,true,false",
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
          "member_number,whatsapp,is_active,is_pengurus,can_be_pic",
          "001,628111111111,true,false,true",
        ].join("\n"),
      ),
    ).toThrow('Kolom CSV wajib tidak ada: "full_name".');
  });

  it("throws when there are no data rows after the header", () => {
    expect(() =>
      parseMasterMemberCsvText(
        "member_number,full_name,whatsapp,is_active,is_pengurus,can_be_pic\n",
      ),
    ).toThrow("Tidak ada baris data setelah header.");
  });
});
