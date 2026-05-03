import { createHash, randomBytes } from "node:crypto";

export type GeneratedAdminInviteToken = {
  /** Hanya ditampilkan sekali kepada Owner atau di email — jangan simpan di DB. */
  rawToken: string;
  /** Disimpan di kolom `AdminInvitation.tokenHash`. */
  tokenHash: string;
};

export function hashAdminInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Token URL-safe (~43 char base64url untuk 32 byte). */
export function generateAdminInviteToken(): GeneratedAdminInviteToken {
  const rawToken = randomBytes(32).toString("base64url");
  return { rawToken, tokenHash: hashAdminInviteToken(rawToken) };
}
