import { describe, expect, it } from "vitest";

import {
  prepareMasterMemberCsvRow,
  type PreparedMasterMemberCsvRow,
} from "./prepare-master-member-csv-row";

describe("prepareMasterMemberCsvRow", () => {
  it("records first line and flags second duplicate member_number", () => {
    const m = new Map<string, number>();
    const cells = (full_name: string) => ({
      member_number: "M-01",
      full_name,
      whatsapp: "",
      is_active: "",
      is_pengurus: "",
      can_be_pic: "",
    });
    const a = prepareMasterMemberCsvRow(2, cells("A"), m);
    const b = prepareMasterMemberCsvRow(3, cells("B"), m);
    expect((a as Extract<PreparedMasterMemberCsvRow, { tag: "ok" }>).tag).toBe(
      "ok",
    );
    expect(b).toEqual({
      tag: "duplicate",
      lineNumberPhysical: 3,
      memberNumber: "M-01",
      firstLineNumber: 2,
    });
  });

  it("rejects empty member_number", () => {
    const m = new Map<string, number>();
    const r = prepareMasterMemberCsvRow(
      2,
      {
        member_number: "  ",
        full_name: "",
        whatsapp: "",
        is_active: "",
        is_pengurus: "",
        can_be_pic: "",
      },
      m,
    );
    expect(r.tag).toBe("reject");
  });

  it("omits unknown boolean token from patch", () => {
    const m = new Map<string, number>();
    const r = prepareMasterMemberCsvRow(
      2,
      {
        member_number: "X",
        full_name: "N",
        whatsapp: "",
        is_active: "maybe",
        is_pengurus: "",
        can_be_pic: "",
      },
      m,
    );
    expect(r.tag).toBe("ok");
    expect(
      Object.prototype.hasOwnProperty.call(
        (r as { patch: Record<string, unknown> }).patch,
        "isActive",
      ),
    ).toBe(false);
  });
});
