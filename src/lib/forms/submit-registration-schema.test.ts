import { MenuMode, MenuSelection } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  createSubmitRegistrationFormSchema,
  isMemberCardPhotoMissingWhenRequired,
  isMemberNumberMissingWhenMember,
  MEMBER_CARD_REQUIRED_WHEN_NUMBER_MESSAGE,
} from "./submit-registration-schema";

const voucherMenuCtx = {
  menuMode: MenuMode.VOUCHER,
  menuSelection: MenuSelection.SINGLE,
  menuItems: [] as { id: string }[],
};

function transferProofFile() {
  return new File([new Uint8Array([1])], "p.jpg", {
    type: "image/jpeg",
  });
}

function minimalVoucherPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    slug: "demo",
    purchaserIsMember: false,
    contactName: "Tester",
    contactWhatsapp: "08123456789",
    qtyPartner: 0,
    partnerName: "",
    partnerWhatsapp: "",
    partnerMemberNumber: "",
    selectedMenuItemIds: [] as string[],
    transferProof: transferProofFile(),
    ...overrides,
  };
}

describe("isMemberCardPhotoMissingWhenRequired", () => {
  it("requires a non-empty file when claimed member number is non-empty", () => {
    expect(
      isMemberCardPhotoMissingWhenRequired({
        claimedMemberNumber: "CISC-1",
        memberCardPhoto: undefined,
      }),
    ).toBe(true);
    const emptyFile = new File([], "x.jpg", { type: "image/jpeg" });
    expect(
      isMemberCardPhotoMissingWhenRequired({
        claimedMemberNumber: "CISC-1",
        memberCardPhoto: emptyFile,
      }),
    ).toBe(true);
    const nonempty = new File([new Uint8Array([1])], "x.jpg", {
      type: "image/jpeg",
    });
    expect(
      isMemberCardPhotoMissingWhenRequired({
        claimedMemberNumber: "CISC-1",
        memberCardPhoto: nonempty,
      }),
    ).toBe(false);
    expect(
      isMemberCardPhotoMissingWhenRequired({
        claimedMemberNumber: "",
        memberCardPhoto: undefined,
      }),
    ).toBe(false);
    expect(
      isMemberCardPhotoMissingWhenRequired({
        claimedMemberNumber: "   ",
        memberCardPhoto: undefined,
      }),
    ).toBe(false);
  });

  it("documents message pairing with schema superRefine", () => {
    expect(MEMBER_CARD_REQUIRED_WHEN_NUMBER_MESSAGE.length).toBeGreaterThan(
      10,
    );
  });
});

describe("isMemberNumberMissingWhenMember", () => {
  it("is true when member and number empty or whitespace", () => {
    expect(
      isMemberNumberMissingWhenMember({
        purchaserIsMember: true,
        claimedMemberNumber: "",
      }),
    ).toBe(true);
    expect(
      isMemberNumberMissingWhenMember({
        purchaserIsMember: true,
        claimedMemberNumber: "   ",
      }),
    ).toBe(true);
    expect(
      isMemberNumberMissingWhenMember({
        purchaserIsMember: true,
        claimedMemberNumber: undefined,
      }),
    ).toBe(true);
  });

  it("is false when not member", () => {
    expect(
      isMemberNumberMissingWhenMember({
        purchaserIsMember: false,
        claimedMemberNumber: "",
      }),
    ).toBe(false);
  });

  it("is false when member with non-empty number", () => {
    expect(
      isMemberNumberMissingWhenMember({
        purchaserIsMember: true,
        claimedMemberNumber: "CISC-1",
      }),
    ).toBe(false);
  });
});

describe("createSubmitRegistrationFormSchema purchaserIsMember", () => {
  const schema = createSubmitRegistrationFormSchema(voucherMenuCtx);

  it("rejects member status without claimed member number", () => {
    const r = schema.safeParse(
      minimalVoucherPayload({ purchaserIsMember: true }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path[0]);
    expect(paths).toContain("claimedMemberNumber");
    const claimedIssue = r.error.issues.find(
      (i) => i.path[0] === "claimedMemberNumber",
    );
    expect(claimedIssue?.message).toMatch(/wajib/i);
  });

  it("rejects claimed number when not member", () => {
    const r = schema.safeParse(
      minimalVoucherPayload({
        claimedMemberNumber: "CISC-TEST",
      }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path[0]);
    expect(paths).toContain("claimedMemberNumber");
  });

  it("rejects member card upload when not member", () => {
    const r = schema.safeParse(
      minimalVoucherPayload({
        memberCardPhoto: transferProofFile(),
      }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path[0]);
    expect(paths).toContain("memberCardPhoto");
  });

  it("accepts member with claimed number and card photo", () => {
    const r = schema.safeParse(
      minimalVoucherPayload({
        purchaserIsMember: true,
        claimedMemberNumber: "CISC-OK",
        memberCardPhoto: transferProofFile(),
      }),
    );
    expect(r.success).toBe(true);
  });
});
