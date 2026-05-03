export function isTransactionalEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.AUTH_TRANSACTIONAL_FROM?.trim() ?? "";
  return key.length > 0 && from.length > 0;
}
