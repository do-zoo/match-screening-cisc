"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, fieldError, type ActionResult } from "@/lib/forms/action-result";
import { toWebp } from "@/lib/uploads/images";
import { putWebpToBlob } from "@/lib/uploads/blob";
import { retry } from "@/lib/uploads/retry";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function uploadAdjustmentProof(
  eventId: string,
  formData: FormData,
): Promise<ActionResult<{ uploadId: string }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const adjustmentId = String(formData.get("adjustmentId") ?? "").trim();
  const file = formData.get("file");

  if (!adjustmentId) return fieldError({ adjustmentId: "ID penyesuaian wajib." });
  if (!(file instanceof File) || file.size === 0) {
    return fieldError({ file: "Pilih file bukti pembayaran." });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return fieldError({ file: "Format file tidak didukung (JPEG/PNG/WebP/HEIC)." });
  }
  if (file.size > MAX_BYTES) {
    return fieldError({ file: "File terlalu besar (maksimal 8 MB)." });
  }

  const adj = await prisma.invoiceAdjustment.findUnique({
    where: { id: adjustmentId },
    select: { id: true, registration: { select: { eventId: true, id: true } } },
  });
  if (!adj || adj.registration.eventId !== eventId) {
    return rootError("Penyesuaian tidak ditemukan.");
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const webp = await toWebp(raw, { maxDim: 1600, quality: 80 });
  const blobPath = `registrations/${adj.registration.id}/adjustments/${adjustmentId}/proof.webp`;

  const putRes = await retry(
    () => putWebpToBlob({ path: blobPath, bytes: webp.bytes }),
    { maxAttempts: 3, delayMs: 250 },
  );

  let uploadRow;
  try {
    uploadRow = await prisma.upload.create({
      data: {
        purpose: "invoice_adjustment_proof",
        registrationId: adj.registration.id,
        invoiceAdjustmentId: adjustmentId,
        blobUrl: putRes.url,
        blobPath: putRes.pathname,
        contentType: "image/webp",
        bytes: webp.bytes.length,
        sha256: webp.sha256,
        width: webp.width,
        height: webp.height,
        originalFilename: file.name,
      },
    });
  } catch (err) {
    try { await del(putRes.url); } catch { /* best-effort */ }
    throw err;
  }

  revalidatePath(`/admin/events/${eventId}/inbox/${adj.registration.id}`);
  return ok({ uploadId: uploadRow.id });
}
