"use server";

import { headers } from "next/headers";
import { del } from "@vercel/blob";

import { auth } from "@/lib/auth/auth";
import { requireAdminSession } from "@/lib/auth/session";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";
import { uploadAdminAvatar } from "@/lib/uploads/upload-admin-avatar";
import { UploadError } from "@/lib/uploads/errors";

export async function updateAdminAvatar(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const session = await requireAdminSession();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return rootError("Pilih berkas gambar terlebih dahulu.");
  }

  let uploadResult: { url: string; pathname: string };
  try {
    uploadResult = await uploadAdminAvatar({
      userId: session.user.id,
      file,
    });
  } catch (err) {
    if (err instanceof UploadError) {
      return rootError(err.message);
    }
    console.error("[updateAdminAvatar] upload error", err);
    return rootError("Gagal mengunggah avatar. Coba lagi.");
  }

  const previousImageUrl = session.user.image;

  try {
    await auth.api.updateUser({
      body: { image: uploadResult.url },
      headers: await headers(),
    });
  } catch (err) {
    try {
      await del(uploadResult.url);
    } catch {
      // best-effort
    }
    console.error("[updateAdminAvatar] updateUser error", err);
    return rootError("Gagal menyimpan avatar. Coba lagi.");
  }

  if (previousImageUrl && previousImageUrl !== uploadResult.url) {
    del(previousImageUrl).catch(() => undefined);
  }

  return ok({ url: uploadResult.url });
}
