import { describe, expect, it } from "vitest";

import {
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
} from "./registration-window";

describe("registration-window", () => {
  const open = new Date("2020-01-01T00:00:00.000Z");
  const close = new Date("2030-01-01T00:00:00.000Z");

  const activeBase = {
    status: "active" as const,
    registrationManualClosed: false,
    registrationCapacity: null as number | null,
    openRegistrationAt: open,
    closeRegistrationAt: close,
  };

  it("is open when active, not manual-closed, window open, and no capacity limit", () => {
    expect(
      isRegistrationOpenForEvent({
        event: activeBase,
        registrationsTowardQuota: 999,
        now: new Date("2025-06-01T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("closes when manually closed", () => {
    expect(
      isRegistrationOpenForEvent({
        event: { ...activeBase, registrationManualClosed: true },
        registrationsTowardQuota: 0,
        now: new Date("2025-06-01T00:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      registrationBlockMessageForPublic({
        eventStatus: "active",
        registrationManualClosed: true,
        registrationCapacity: null,
        registrationsTowardQuota: 0,
        openRegistrationAt: open,
        closeRegistrationAt: close,
        now: new Date("2025-06-01T00:00:00.000Z"),
      }),
    ).toMatch(/ditutup/i);
  });

  it("closes at capacity boundary", () => {
    expect(
      isRegistrationOpenForEvent({
        event: { ...activeBase, registrationCapacity: 10 },
        registrationsTowardQuota: 10,
        now: new Date("2025-06-01T00:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      registrationBlockMessageForPublic({
        eventStatus: "active",
        registrationManualClosed: false,
        registrationCapacity: 10,
        registrationsTowardQuota: 10,
        openRegistrationAt: open,
        closeRegistrationAt: close,
        now: new Date("2025-06-01T00:00:00.000Z"),
      }),
    ).toMatch(/habis/i);
  });
});
