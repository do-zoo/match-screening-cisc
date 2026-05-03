"use client";

import { toast } from "sonner";

import type { ActionErr } from "@/lib/forms/action-result";
import { formatActionErrorMessage } from "@/lib/forms/format-action-error-message";

export type CudOperation = "create" | "update" | "delete";

const DEFAULT_SUCCESS: Record<CudOperation, string> = {
  create: "Data berhasil ditambahkan.",
  update: "Data berhasil diperbarui.",
  delete: "Data berhasil dihapus.",
};

/** Toast sukses CUD. Gunakan explicitMessage untuk konteks singkat (bahasa Indonesia). */
export function toastCudSuccess(
  operation: CudOperation,
  explicitMessage?: string,
): void {
  toast.success(explicitMessage ?? DEFAULT_SUCCESS[operation]);
}

/** Toast gagal untuk sembarang ActionErr (setelah pemeriksaan !result.ok). */
export function toastActionErr(err: ActionErr, fallback?: string): void {
  toast.error(formatActionErrorMessage(err, fallback ?? "Terjadi kesalahan."));
}
