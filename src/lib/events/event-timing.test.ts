import { describe, expect, it } from "vitest";

import {
  canEditEventBeforeRegistrationClose,
  getEventPhase,
  isRegistrationTimeWindowOpen,
} from "./event-timing";

describe("event-timing", () => {
  const t = {
    openRegistrationAt: new Date("2026-06-01T08:00:00.000Z"),
    closeRegistrationAt: new Date("2026-06-10T12:00:00.000Z"),
    openGateAt: new Date("2026-06-10T16:00:00.000Z"),
    kickOffAt: new Date("2026-06-10T19:00:00.000Z"),
  };

  it("isRegistrationTimeWindowOpen true inside window", () => {
    expect(
      isRegistrationTimeWindowOpen(t, new Date("2026-06-05T12:00:00.000Z")),
    ).toBe(true);
  });

  it("isRegistrationTimeWindowOpen false before open", () => {
    expect(
      isRegistrationTimeWindowOpen(t, new Date("2026-05-01T12:00:00.000Z")),
    ).toBe(false);
  });

  it("isRegistrationTimeWindowOpen false at or after close", () => {
    expect(
      isRegistrationTimeWindowOpen(t, new Date("2026-06-10T12:00:00.000Z")),
    ).toBe(false);
  });

  it("getEventPhase progresses", () => {
    expect(getEventPhase(t, new Date("2026-05-01T00:00:00.000Z"))).toBe(
      "before_registration",
    );
    expect(getEventPhase(t, new Date("2026-06-05T12:00:00.000Z"))).toBe(
      "registration_open",
    );
    expect(getEventPhase(t, new Date("2026-06-10T14:00:00.000Z"))).toBe(
      "registration_closed_before_gate",
    );
    expect(getEventPhase(t, new Date("2026-06-10T17:00:00.000Z"))).toBe(
      "gates_open",
    );
    expect(getEventPhase(t, new Date("2026-06-10T20:00:00.000Z"))).toBe(
      "after_kickoff",
    );
  });

  it("canEditEventBeforeRegistrationClose", () => {
    expect(
      canEditEventBeforeRegistrationClose(
        t,
        new Date("2026-06-10T11:59:59.000Z"),
      ),
    ).toBe(true);
    expect(
      canEditEventBeforeRegistrationClose(
        t,
        new Date("2026-06-10T12:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
