import type { UploadPurpose } from "@prisma/client";
import { retry } from "@/lib/uploads/retry";
import { toWebp } from "@/lib/uploads/images";
import { putWebpToBlob } from "@/lib/uploads/blob";
import { saveUploadMetadata } from "@/lib/uploads/save-upload";
import { UploadError } from "@/lib/uploads/errors";

export async function uploadImageForRegistration(input: {
  purpose: Extract<UploadPurpose, "transfer_proof" | "member_card_photo">;
  registrationId: string;
  file: File;
}): Promise<{ uploadId: string; url: string }> {
  if (!input.file.type.startsWith("image/")) {
    throw new UploadError("File must be an image.", {
      code: "invalid_content_type",
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

  const row = await saveUploadMetadata({
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

  return { uploadId: row.id, url: row.blobUrl };
}
