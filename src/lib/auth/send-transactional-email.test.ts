import { afterEach, describe, expect, it, vi } from "vitest";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe("sendTransactionalEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockSend.mockReset();
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "App <x@y.com>");
    const { sendTransactionalEmail } = await import(
      "@/lib/auth/send-transactional-email"
    );
    await expect(
      sendTransactionalEmail({ to: "a@b.com", subject: "Hi", text: "Hello" })
    ).rejects.toThrow("Email pengiriman belum dikonfigurasi.");
  });

  it("calls resend.emails.send with text and html when both provided", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "App <noreply@app.com>");
    mockSend.mockResolvedValue({ data: { id: "abc" }, error: null });
    const { sendTransactionalEmail } = await import(
      "@/lib/auth/send-transactional-email"
    );
    await sendTransactionalEmail({
      to: "user@example.com",
      subject: "Test",
      text: "Plain text",
      html: "<p>HTML version</p>",
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Test",
        text: "Plain text",
        html: "<p>HTML version</p>",
      })
    );
  });

  it("calls resend.emails.send without html when not provided", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "App <noreply@app.com>");
    mockSend.mockResolvedValue({ data: { id: "xyz" }, error: null });
    const { sendTransactionalEmail } = await import(
      "@/lib/auth/send-transactional-email"
    );
    await sendTransactionalEmail({
      to: "user@example.com",
      subject: "OTP",
      text: "Your code: 123456",
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Your code: 123456" })
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.not.objectContaining({ html: expect.anything() })
    );
  });
});
