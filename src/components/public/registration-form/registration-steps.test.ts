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
    ).toEqual(["purchaserIsMember", "claimedMemberNumber"]);
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
