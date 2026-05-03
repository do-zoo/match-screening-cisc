import { describe, expect, it } from "vitest";

import { renderMagicLinkEmail, renderOtpEmail } from "@/lib/auth/emails/render-emails";

describe("renderMagicLinkEmail", () => {
  it("includes the URL as an href", async () => {
    const url = "https://example.com/api/auth/magic-link/verify?token=abc123";
    const html = await renderMagicLinkEmail(url);
    expect(html).toContain(url);
  });

  it("includes Indonesian action text", async () => {
    const html = await renderMagicLinkEmail("https://example.com");
    expect(html).toContain("Masuk sekarang");
  });

  it("includes expiry warning in Indonesian", async () => {
    const html = await renderMagicLinkEmail("https://example.com");
    expect(html).toContain("kedaluwarsa");
  });
});

describe("renderOtpEmail", () => {
  it("includes the OTP code", async () => {
    const html = await renderOtpEmail("847291");
    expect(html).toContain("847291");
  });

  it("includes Indonesian label", async () => {
    const html = await renderOtpEmail("000000");
    expect(html).toContain("Kode verifikasi");
  });
});
