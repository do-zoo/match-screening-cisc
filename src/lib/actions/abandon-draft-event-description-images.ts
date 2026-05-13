"use server";

import { z } from "zod";

import { guardOwnerOrAdmin, isAuthError } from "@/lib/actions/guard";
import {
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { prisma } from "@/lib/db/prisma";
import { verifyDescriptionAssetEventId } from "@/lib/public/description-asset-token";
import { deleteAllBlobsWithPrefix } from "@/lib/uploads/delete-blobs-by-prefix";

/**
 * Hapus gambar deskripsi yang terunggah ke prefix draf `events/{draftEventId}/description/`
 * bila acara dengan ID tersebut belum tersimpan. Dipanggil dari klien saat meninggalkan
 * halaman Buat acara tanpa sukses simpan (bukan untuk acara yang sudah ada).
 */
export async function abandonDraftEventDescriptionImages(
  draftEventId: string,
  token: string,
): Promise<ActionResult<{ deleted: number }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const idParsed = z.string().uuid().safeParse(draftEventId);
  if (!idParsed.success) {
    return rootError("Permintaan tidak valid.");
  }

  if (!verifyDescriptionAssetEventId(draftEventId, token)) {
    return rootError("Token tidak valid.");
  }

  const existing = await prisma.event.findUnique({
    where: { id: draftEventId },
    select: { id: true },
  });
  if (existing) {
    return ok({ deleted: 0 });
  }

  const prefix = `events/${draftEventId}/description/`;
  try {
    const deleted = await deleteAllBlobsWithPrefix(prefix);
    return ok({ deleted });
  } catch (e) {
    console.error("[abandonDraftEventDescriptionImages] blob delete failed", e);
    return rootError("Gagal membersihkan gambar draf.");
  }
}
