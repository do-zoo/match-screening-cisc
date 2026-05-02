/** Single rule: trim ASCII whitespace, uppercase A–Z for stable uniqueness. */
export function normalizePublicManagementCode(raw: string): string {
  return raw.trim().toUpperCase();
}
