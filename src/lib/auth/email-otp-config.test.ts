import { afterEach, describe, expect, it, vi } from "vitest";

import { isEmailOtpConfigured } from "@/lib/auth/email-otp-config";

describe("isEmailOtpConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when RESEND_API_KEY is missing", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "Match Screening <otp@example.com>");
    expect(isEmailOtpConfigured()).toBe(false);
  });

  it("returns false when AUTH_TRANSACTIONAL_FROM is missing", () => {
    vi.stubEnv("RESEND_API_KEY", "re_xxx");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "");
    expect(isEmailOtpConfigured()).toBe(false);
  });

  it("returns true when both are non-empty trimmed", () => {
    vi.stubEnv("RESEND_API_KEY", "re_xxx");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "Match Screening <otp@example.com>");
    expect(isEmailOtpConfigured()).toBe(true);
  });
});
