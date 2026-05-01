import { describe, expect, it } from "vitest";

import {
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
} from "./registration-window";

describe("registration-window", () => {
  const activeBase = {
    status: "active" as const,
    registrationManualClosed: false,
    registrationCapacity: null as number | null,
  };

  it("is open when active, not manual-closed, and no capacity limit", () => {
    expect(
      isRegistrationOpenForEvent({
        event: activeBase,
        registrationsTowardQuota: 999,
      })
    ).toBe(true);
  });

  it("closes when manually closed", () => {
    expect(
      isRegistrationOpenForEvent({
        event: { ...activeBase, registrationManualClosed: true },
        registrationsTowardQuota: 0,
      })
    ).toBe(false);
    expect(
      registrationBlockMessageForPublic({
        eventStatus: "active",
        registrationManualClosed: true,
        registrationCapacity: null,
        registrationsTowardQuota: 0,
      })
    ).toMatch(/ditutup/i);
  });

  it("closes at capacity boundary", () => {
    expect(
      isRegistrationOpenForEvent({
        event: { ...activeBase, registrationCapacity: 10 },
        registrationsTowardQuota: 10,
      })
    ).toBe(false);
    expect(
      registrationBlockMessageForPublic({
        eventStatus: "active",
        registrationManualClosed: false,
        registrationCapacity: 10,
        registrationsTowardQuota: 10,
      })
    ).toMatch(/habis/i);
  });
});
