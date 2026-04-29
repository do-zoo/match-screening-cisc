import { put } from "@vercel/blob";
import { UploadError } from "@/lib/uploads/errors";

export async function putWebpToBlob(opts: {
  path: string;
  bytes: Buffer;
}): Promise<{ url: string; pathname: string }> {
  try {
    const res = await put(opts.path, opts.bytes, {
      access: "private",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url: res.url, pathname: res.pathname };
  } catch {
    throw new UploadError("Upload failed. Please retry.", {
      code: "blob_put_failed",
      recoverable: true,
    });
  }
}
