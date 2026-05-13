import { put } from "@vercel/blob";
import { UploadError } from "@/lib/uploads/errors";

export async function putWebpToBlob(opts: {
  path: string;
  bytes: Buffer;
}): Promise<{ url: string; pathname: string }> {
  try {
    const res = await put(opts.path, opts.bytes, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url: res.url, pathname: res.pathname };
  } catch (err) {
    // Keep user-facing errors generic, but log the real failure for debugging.
    console.error(`[blob] put failed for path: ${opts.path}`, err);

    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "";
    if (
      message.includes("Cannot use public access on a private store") ||
      message.includes("store is configured with private access")
    ) {
      throw new UploadError("Blob store is private.", {
        code: "blob_store_private",
        recoverable: false,
      });
    }

    throw new UploadError("Upload failed. Please retry.", {
      code: "blob_put_failed",
      recoverable: true,
    });
  }
}
