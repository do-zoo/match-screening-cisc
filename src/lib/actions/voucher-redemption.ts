"use server";

import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { rootError, type ActionResult } from "@/lib/forms/action-result";

/** Model acara baru tidak lagi memakai voucher menu. */
export async function redeemVoucher(
  _eventId: string,
  _ticketId: string,
  _menuItemId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(_eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }
  return rootError("Penukaran voucher tidak tersedia untuk acara ini.");
}
