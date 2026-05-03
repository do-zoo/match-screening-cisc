import type { ActionErr } from "@/lib/forms/action-result";

/**
 * Merangkum ActionErr menjadi satu string untuk toast atau log.
 * Urutan: rootError → gabungan fieldErrors → fallback.
 */
export function formatActionErrorMessage(
  err: ActionErr,
  fallback = "Terjadi kesalahan.",
): string {
  if (err.rootError?.trim()) return err.rootError.trim();
  const fe = err.fieldErrors;
  if (fe && Object.keys(fe).length > 0) {
    return Object.entries(fe)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
  }
  return fallback;
}
