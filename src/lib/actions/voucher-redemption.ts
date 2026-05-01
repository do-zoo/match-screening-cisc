"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";

export async function redeemVoucher(
  eventId: string,
  ticketId: string,
  menuItemId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      eventId: true,
      voucherRedeemedMenuItemId: true,
      registration: {
        select: {
          id: true,
          event: { select: { id: true, menuMode: true } },
        },
      },
    },
  });

  if (!ticket || ticket.eventId !== eventId) {
    return rootError("Tiket tidak ditemukan.");
  }
  if (ticket.registration.event.menuMode !== "VOUCHER") {
    return rootError("Acara ini tidak menggunakan mode voucher.");
  }
  if (ticket.voucherRedeemedMenuItemId) {
    return rootError("Voucher tiket ini sudah digunakan.");
  }

  const menuItem = await prisma.eventMenuItem.findUnique({
    where: { id: menuItemId },
    select: { id: true, eventId: true, voucherEligible: true },
  });

  if (!menuItem || menuItem.eventId !== eventId) {
    return rootError("Menu item tidak ditemukan untuk acara ini.");
  }
  if (!menuItem.voucherEligible) {
    return rootError("Menu item ini tidak eligible untuk penukaran voucher.");
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      voucherRedeemedMenuItemId: menuItemId,
      voucherRedeemedAt: new Date(),
    },
  });

  revalidatePath(`/admin/events/${eventId}/inbox/${ticket.registration.id}`);
  return ok({ ok: true });
}
