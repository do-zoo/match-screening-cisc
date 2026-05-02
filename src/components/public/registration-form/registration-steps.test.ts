import { MenuMode } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildRegistrationSteps,
  getTriggerFieldsForStep,
  resolveActiveStepAfterStepsChange,
  type RegistrationStepId,
} from "./registration-steps";

describe("buildRegistrationSteps", () => {
  it("orders purchaser, optional partner and menu, then payment last", () => {
    expect(
      buildRegistrationSteps(MenuMode.VOUCHER, false),
    ).toEqual(["purchaser", "payment"]);
    expect(
      buildRegistrationSteps(MenuMode.PRESELECT, false),
    ).toEqual(["purchaser", "menu", "payment"]);
    expect(
      buildRegistrationSteps(MenuMode.VOUCHER, true),
    ).toEqual(["purchaser", "partner", "payment"]);
    expect(
      buildRegistrationSteps(MenuMode.PRESELECT, true),
    ).toEqual(["purchaser", "partner", "menu", "payment"]);
  });
});

describe("resolveActiveStepAfterStepsChange", () => {
  it("keeps current id when still in the step list", () => {
    const steps = ["purchaser", "menu", "payment"] as const;
    expect(
      resolveActiveStepAfterStepsChange("menu", [...steps] as RegistrationStepId[]),
    ).toBe("menu");
  });

  it("moves forward in canonical order when current id was removed", () => {
    const steps = ["purchaser", "payment"] as RegistrationStepId[];
    expect(resolveActiveStepAfterStepsChange("partner", steps)).toBe("payment");
    const withMenu = ["purchaser", "menu", "payment"] as RegistrationStepId[];
    expect(
      resolveActiveStepAfterStepsChange("partner", withMenu),
    ).toBe("menu");
  });
});

describe("getTriggerFieldsForStep purchaser gate", () => {
  const qty = 0 as const;

  it("member path before directory verified validates only purchaser + claimed", () => {
    expect(
      getTriggerFieldsForStep("purchaser", qty, {
        purchaserIsMember: true,
        directoryVerified: false,
      }),
    ).toEqual([
      "purchaserIsMember",
      "claimedMemberNumber",
      "managementPublicCode",
    ]);
  });

  it("member path after directory verified includes kontak dan foto kartu", () => {
    expect(
      getTriggerFieldsForStep("purchaser", qty, {
        purchaserIsMember: true,
        directoryVerified: true,
      }),
    ).toEqual([
      "purchaserIsMember",
      "claimedMemberNumber",
      "contactName",
      "contactWhatsapp",
      "memberCardPhoto",
    ]);
  });

  it("non-member path ignores directoryVerified", () => {
    expect(
      getTriggerFieldsForStep("purchaser", qty, {
        purchaserIsMember: false,
      }),
    ).toEqual(["purchaserIsMember", "contactName", "contactWhatsapp"]);
  });
});

describe("getTriggerFieldsForStep partner gate", () => {
  const qty = 1 as const;

  it("asks for partner member status before other partner fields when unknown", () => {
    expect(getTriggerFieldsForStep("partner", qty, {})).toEqual([
      "qtyPartner",
      "partnerIsMember",
    ]);
  });

  it("non-member partner path validates name/contact without nomor kartu partner", () => {
    expect(
      getTriggerFieldsForStep("partner", qty, {
        partnerIsMember: false,
      }),
    ).toEqual([
      "qtyPartner",
      "partnerIsMember",
      "partnerName",
      "partnerWhatsapp",
    ]);
  });

  it("member partner path before directory only validates nominal partner member", () => {
    expect(
      getTriggerFieldsForStep("partner", qty, {
        partnerIsMember: true,
        partnerDirectoryVerified: false,
      }),
    ).toEqual(["qtyPartner", "partnerIsMember", "partnerMemberNumber"]);
  });

  it("member partner after directory includes kartu + kontak untuk partner", () => {
    expect(
      getTriggerFieldsForStep("partner", qty, {
        partnerIsMember: true,
        partnerDirectoryVerified: true,
      }),
    ).toEqual([
      "qtyPartner",
      "partnerIsMember",
      "partnerMemberNumber",
      "partnerMemberCardPhoto",
      "partnerName",
      "partnerWhatsapp",
    ]);
  });
});
