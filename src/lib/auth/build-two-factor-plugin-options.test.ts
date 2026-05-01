import { afterEach, describe, expect, it, vi } from "vitest";

describe("buildTwoFactorPluginOptions", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("omits otpOptions when email OTP is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "");
    const { buildTwoFactorPluginOptions } = await import(
      "@/lib/auth/build-two-factor-plugin-options"
    );
    const opts = buildTwoFactorPluginOptions();
    expect(opts).not.toHaveProperty("otpOptions");
  });

  it("includes otpOptions when email OTP is configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "App <x@y.com>");
    const { buildTwoFactorPluginOptions } = await import(
      "@/lib/auth/build-two-factor-plugin-options"
    );
    const opts = buildTwoFactorPluginOptions();
    expect(opts).toHaveProperty("otpOptions");
    expect(typeof opts.otpOptions?.sendOTP).toBe("function");
  });
});
