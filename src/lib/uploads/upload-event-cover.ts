import { del } from "@vercel/blob";

import { toWebp } from "@/lib/uploads/images";
import { putWebpToBlob } from "@/lib/uploads/blob";
import { retry } from "@/lib/uploads/retry";
import { UploadError } from "@/lib/uploads/errors";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Upload or replace hero cover image for Event; deletes previous Blob URL best-effort (unless opted out). */
export async function uploadEventHeroCover(opts: {
  eventId: string;
  file: File;
  previousBlobUrl?: string | null;
  /** When `false`, skip deleting `previousBlobUrl` so the caller can delete after DB commit. Default `true`. */
  deletePreviousBlob?: boolean;
}): Promise<{ url: string; pathname: string }> {
  const { file } = opts;
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new UploadError("Gunakan berkas gambar.", {
      code: "invalid_content_type",
      recoverable: true,
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Ukuran berkas terlalu besar.", {
      code: "file_too_large",
      recoverable: true,
    });
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const webp = await toWebp(raw, { maxDim: 1600, quality: 80 });
  const blobPath = `events/${opts.eventId}/cover.webp`;

  const putRes = await retry(
    () => putWebpToBlob({ path: blobPath, bytes: webp.bytes }),
    { maxAttempts: 3, delayMs: 250 },
  );

  if (
    opts.deletePreviousBlob !== false &&
    opts.previousBlobUrl?.startsWith("http")
  ) {
    try {
      await del(opts.previousBlobUrl);
    } catch {
      // ignore cleanup failures
    }
  }

  return { url: putRes.url, pathname: putRes.pathname };
}
