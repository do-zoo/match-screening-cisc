import type { UploadPurpose } from "@prisma/client";
import { del } from "@vercel/blob";
import { retry } from "@/lib/uploads/retry";
import { toWebp } from "@/lib/uploads/images";
import { putWebpToBlob } from "@/lib/uploads/blob";
import { saveUploadMetadata } from "@/lib/uploads/save-upload";
import { UploadError } from "@/lib/uploads/errors";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function uploadImageForRegistration(input: {
  purpose: Extract<UploadPurpose, "transfer_proof" | "member_card_photo">;
  registrationId: string;
  file: File;
}): Promise<{ uploadId: string; url: string }> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(input.file.type)) {
    throw new UploadError("File must be an image.", {
      code: "invalid_content_type",
      recoverable: true,
    });
  }

  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("File is too large.", {
      code: "file_too_large",
      recoverable: true,
    });
  }

  const raw = Buffer.from(await input.file.arrayBuffer());
  const webp = await toWebp(raw, { maxDim: 1600, quality: 80 });

  const blobPath = `registrations/${input.registrationId}/${input.purpose}.webp`;
  const putRes = await retry(
    () => putWebpToBlob({ path: blobPath, bytes: webp.bytes }),
    { maxAttempts: 3, delayMs: 250 },
  );

  let row;
  try {
    row = await saveUploadMetadata({
      purpose: input.purpose,
      registrationId: input.registrationId,
      blobUrl: putRes.url,
      blobPath: putRes.pathname,
      contentType: "image/webp",
      bytes: webp.bytes.length,
      sha256: webp.sha256,
      width: webp.width,
      height: webp.height,
      originalFilename: input.file.name,
    });
  } catch (err) {
    try {
      await del(putRes.url);
    } catch {
      // best-effort cleanup
    }
    throw err;
  }

  return { uploadId: row.id, url: row.blobUrl };
}
