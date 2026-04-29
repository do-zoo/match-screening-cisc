import type { UploadPurpose } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function saveUploadMetadata(input: {
  purpose: UploadPurpose;
  blobUrl: string;
  blobPath: string;
  contentType: string;
  bytes: number;
  sha256: string;
  width?: number;
  height?: number;
  originalFilename?: string;
  registrationId?: string;
  invoiceAdjustmentId?: string;
}) {
  return prisma.upload.create({
    data: {
      purpose: input.purpose,
      blobUrl: input.blobUrl,
      blobPath: input.blobPath,
      contentType: input.contentType,
      bytes: input.bytes,
      sha256: input.sha256,
      width: input.width,
      height: input.height,
      originalFilename: input.originalFilename,
      registrationId: input.registrationId,
      invoiceAdjustmentId: input.invoiceAdjustmentId,
    },
  });
}
