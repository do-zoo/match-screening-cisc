import sharp from "sharp";
import { UploadError } from "@/lib/uploads/errors";

export type WebpOutput = {
  bytes: Buffer;
  width: number;
  height: number;
  sha256: string;
};

async function sha256Hex(buf: Buffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function toWebp(
  input: Buffer,
  opts: { maxDim: number; quality: number },
): Promise<WebpOutput> {
  try {
    const image = sharp(input, { failOn: "none" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) {
      throw new UploadError("File is not a valid image.", {
        code: "invalid_image",
        recoverable: true,
      });
    }

    const resized = image.resize({
      width: opts.maxDim,
      height: opts.maxDim,
      fit: "inside",
      withoutEnlargement: true,
    });

    const bytes = await resized.webp({ quality: opts.quality }).toBuffer();
    const outMeta = await sharp(bytes).metadata();

    return {
      bytes,
      width: outMeta.width ?? meta.width,
      height: outMeta.height ?? meta.height,
      sha256: await sha256Hex(bytes),
    };
  } catch (err) {
    if (err instanceof UploadError) throw err;
    throw new UploadError("Failed to process image.", {
      code: "image_processing_failed",
      recoverable: true,
    });
  }
}
