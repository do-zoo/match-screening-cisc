import { afterEach, describe, expect, it, vi } from "vitest";

import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";

describe("isTransactionalEmailConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when RESEND_API_KEY is missing", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "Match Screening <otp@example.com>");
    expect(isTransactionalEmailConfigured()).toBe(false);
  });

  it("returns false when AUTH_TRANSACTIONAL_FROM is missing", () => {
    vi.stubEnv("RESEND_API_KEY", "re_xxx");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "");
    expect(isTransactionalEmailConfigured()).toBe(false);
  });

  it("returns true when both are non-empty trimmed", () => {
    vi.stubEnv("RESEND_API_KEY", "re_xxx");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "Match Screening <otp@example.com>");
    expect(isTransactionalEmailConfigured()).toBe(true);
  });
});
