import { describe, expect, it } from "vitest";

import { resolveOutboundNotifyBehaviour } from "./notification-outbound-mode";

describe("resolveOutboundNotifyBehaviour", () => {
  it("off → no console, no provider", () => {
    expect(resolveOutboundNotifyBehaviour("off")).toEqual({
      shouldLogToConsole: false,
      shouldAttemptProviderSend: false,
    });
  });

  it("log_only → console, no provider", () => {
    expect(resolveOutboundNotifyBehaviour("log_only")).toEqual({
      shouldLogToConsole: true,
      shouldAttemptProviderSend: false,
    });
  });

  it("live → console + provider hook", () => {
    expect(resolveOutboundNotifyBehaviour("live")).toEqual({
      shouldLogToConsole: true,
      shouldAttemptProviderSend: true,
    });
  });
});
