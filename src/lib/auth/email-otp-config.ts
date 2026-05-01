/**
 * Email OTP for Better Auth twoFactor plugin is only enabled when outbound
 * transactional email is configured (Resend + RFC From).
 */
export function isEmailOtpConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.AUTH_TRANSACTIONAL_FROM?.trim() ?? "";
  return key.length > 0 && from.length > 0;
}
