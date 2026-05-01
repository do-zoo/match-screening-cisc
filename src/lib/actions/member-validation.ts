"use server";

import { revalidatePath } from "next/cache";
import {
  InvoiceAdjustmentType,
  MemberValidation,
  TicketPriceType,
  TicketRole,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";

export async function overrideMemberValidation(
  eventId: string,
  registrationId: string,
  {
    validation,
    newPrimaryPriceType,
  }: {
    validation: MemberValidation;
    /** Pass new price type only when overriding member→non_member or vice versa. */
    newPrimaryPriceType?: TicketPriceType;
  },
): Promise<ActionResult<{ adjustmentCreated: boolean }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      eventId: true,
      memberValidation: true,
      ticketMemberPriceApplied: true,
      ticketNonMemberPriceApplied: true,
      tickets: {
        where: { role: TicketRole.primary },
        select: { id: true, ticketPriceType: true },
      },
    },
  });

  if (!reg || reg.eventId !== eventId) {
    return rootError("Pendaftaran tidak ditemukan.");
  }

  const primaryTicket = reg.tickets[0];
  if (!primaryTicket) {
    return rootError("Tiket utama tidak ditemukan.");
  }

  let adjustmentCreated = false;

  await prisma.$transaction(async (tx) => {
    // Update registration memberValidation
    await tx.registration.update({
      where: { id: registrationId },
      data: { memberValidation: validation },
    });

    // If price type is being changed, update ticket and create adjustment if underpayment
    if (
      newPrimaryPriceType &&
      newPrimaryPriceType !== primaryTicket.ticketPriceType
    ) {
      await tx.ticket.update({
        where: { id: primaryTicket.id },
        data: { ticketPriceType: newPrimaryPriceType },
      });

      // Compute delta: positive = underpayment
      const oldPrice =
        primaryTicket.ticketPriceType === "member"
          ? reg.ticketMemberPriceApplied
          : reg.ticketNonMemberPriceApplied;
      const newPrice =
        newPrimaryPriceType === "member"
          ? reg.ticketMemberPriceApplied
          : reg.ticketNonMemberPriceApplied;
      const delta = newPrice - oldPrice;

      if (delta > 0) {
        await tx.invoiceAdjustment.create({
          data: {
            registrationId,
            type: InvoiceAdjustmentType.underpayment,
            amount: delta,
          },
        });
        adjustmentCreated = true;
      }
    }
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ adjustmentCreated });
}
