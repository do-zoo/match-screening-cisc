import { describe, expect, it } from "vitest";

import {
  REGISTRATION_STEP_ORDER,
  registrationStepTitle,
  type RegistrationStepId,
} from "./registration-steps";

describe("REGISTRATION_STEP_ORDER", () => {
  it("has category, holders, payment in order", () => {
    expect(REGISTRATION_STEP_ORDER).toEqual(["category", "holders", "payment"]);
  });
});

describe("registrationStepTitle", () => {
  it("returns Indonesian label for each step", () => {
    expect(registrationStepTitle("category")).toBe("Pilih Tiket");
    expect(registrationStepTitle("holders")).toBe("Data Peserta");
    expect(registrationStepTitle("payment")).toBe("Pembayaran");
  });

  it("covers all step ids in REGISTRATION_STEP_ORDER", () => {
    for (const id of REGISTRATION_STEP_ORDER) {
      expect(registrationStepTitle(id as RegistrationStepId)).toBeTruthy();
    }
  });
});
