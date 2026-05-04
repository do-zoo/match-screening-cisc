/**
 * Origin aplikasi untuk taut undangan (`BETTER_AUTH_URL`).
 */
export function buildAdminInviteAcceptUrl(rawToken: string): string {
  const base = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "") ?? "";
  if (!base) {
    throw new Error(
      "BETTER_AUTH_URL belum diatur — diperlukan untuk membangun taut undangan.",
    );
  }
  return `${base}/admin/invite/${rawToken}`;
}
