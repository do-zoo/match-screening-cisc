import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "event-description-asset:v1:";

function secretKey(): string {
  const s =
    process.env.DESCRIPTION_ASSET_SIGNING_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!s) {
    throw new Error(
      "Atur BETTER_AUTH_SECRET atau DESCRIPTION_ASSET_SIGNING_SECRET untuk penandatanganan aset deskripsi.",
    );
  }
  return s;
}

/** Token untuk mengizinkan unggah gambar deskripsi sebelum baris Event dibuat (halaman Buat acara). */
export function signDescriptionAssetEventId(eventId: string): string {
  return createHmac("sha256", secretKey())
    .update(PREFIX + eventId)
    .digest("base64url");
}

export function verifyDescriptionAssetEventId(eventId: string, token: string): boolean {
  let expected: string;
  try {
    expected = signDescriptionAssetEventId(eventId);
  } catch {
    return false;
  }
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
