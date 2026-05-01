import { MenuMode, MenuSelection } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { createSubmitRegistrationFormSchema } from "./submit-registration-schema";

function nonemptyFile(name = "proof.png"): File {
  return new File([new Uint8Array([1])], name, { type: "image/png" });
}

const baseScalars = () => ({
  slug: "dinner-gala",
  contactName: "Budi Santoso",
  contactWhatsapp: "081234567890",
  claimedMemberNumber: undefined as string | undefined,
  qtyPartner: 0 as 0 | 1,
  partnerName: "",
  partnerWhatsapp: "",
  partnerMemberNumber: "",
  selectedMenuItemIds: undefined as string[] | undefined,
  memberCardPhoto: undefined as File | undefined,
});

describe("createSubmitRegistrationFormSchema", () => {
  it("accepts voucher event with proof and empty menu IDs", () => {
    const schema = createSubmitRegistrationFormSchema({
      menuMode: MenuMode.VOUCHER,
      menuSelection: MenuSelection.MULTI,
      menuItems: [{ id: "a1" }],
    });
    const r = schema.safeParse({
      ...baseScalars(),
      selectedMenuItemIds: [],
      transferProof: nonemptyFile(),
    });
    expect(r.success).toBe(true);
  });

  it("rejects voucher when menu IDs are submitted", () => {
    const schema = createSubmitRegistrationFormSchema({
      menuMode: MenuMode.VOUCHER,
      menuSelection: MenuSelection.MULTI,
      menuItems: [{ id: "a1" }],
    });
    const r = schema.safeParse({
      ...baseScalars(),
      selectedMenuItemIds: ["a1"],
      transferProof: nonemptyFile(),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) =>
          String(i.path[0]).includes("selectedMenuItemIds"),
        ),
      ).toBe(true);
    }
  });

  it("requires exactly one PRESELECT SINGLE selection", () => {
    const schema = createSubmitRegistrationFormSchema({
      menuMode: MenuMode.PRESELECT,
      menuSelection: MenuSelection.SINGLE,
      menuItems: [{ id: "x" }, { id: "y" }],
    });
    const fail = schema.safeParse({
      ...baseScalars(),
      selectedMenuItemIds: [],
      transferProof: nonemptyFile(),
    });
    expect(fail.success).toBe(false);
    const ok = schema.safeParse({
      ...baseScalars(),
      selectedMenuItemIds: ["x"],
      transferProof: nonemptyFile(),
    });
    expect(ok.success).toBe(true);
  });

  it("rejects unknown menu item id under PRESELECT", () => {
    const schema = createSubmitRegistrationFormSchema({
      menuMode: MenuMode.PRESELECT,
      menuSelection: MenuSelection.SINGLE,
      menuItems: [{ id: "x" }],
    });
    const r = schema.safeParse({
      ...baseScalars(),
      selectedMenuItemIds: ["fake-id"],
      transferProof: nonemptyFile(),
    });
    expect(r.success).toBe(false);
  });

  it("requires partner name when qtyPartner is 1", () => {
    const schema = createSubmitRegistrationFormSchema({
      menuMode: MenuMode.VOUCHER,
      menuSelection: MenuSelection.MULTI,
      menuItems: [],
    });
    const r = schema.safeParse({
      ...baseScalars(),
      qtyPartner: 1,
      partnerName: "",
      selectedMenuItemIds: [],
      transferProof: nonemptyFile(),
    });
    expect(r.success).toBe(false);
  });

  it("requires member card when claiming membership", () => {
    const schema = createSubmitRegistrationFormSchema({
      menuMode: MenuMode.VOUCHER,
      menuSelection: MenuSelection.MULTI,
      menuItems: [],
    });
    const r = schema.safeParse({
      ...baseScalars(),
      claimedMemberNumber: "CISC-99",
      selectedMenuItemIds: [],
      transferProof: nonemptyFile(),
    });
    expect(r.success).toBe(false);
  });

  it("requires non-empty transfer proof file", () => {
    const schema = createSubmitRegistrationFormSchema({
      menuMode: MenuMode.VOUCHER,
      menuSelection: MenuSelection.MULTI,
      menuItems: [],
    });
    const empty = new File([], "empty.png", { type: "image/png" });
    const r = schema.safeParse({
      ...baseScalars(),
      selectedMenuItemIds: [],
      transferProof: empty,
    });
    expect(r.success).toBe(false);
  });

  it("rejects duplicate member numbers for partner flow", () => {
    const schema = createSubmitRegistrationFormSchema({
      menuMode: MenuMode.VOUCHER,
      menuSelection: MenuSelection.MULTI,
      menuItems: [],
    });
    const r = schema.safeParse({
      ...baseScalars(),
      claimedMemberNumber: "CISC-A",
      partnerMemberNumber: "CISC-A",
      qtyPartner: 1,
      partnerName: "Partner",
      memberCardPhoto: nonemptyFile("card.webp"),
      selectedMenuItemIds: [],
      transferProof: nonemptyFile(),
    });
    expect(r.success).toBe(false);
  });
});
