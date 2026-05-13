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
import { eventRegistrationDetailPath, eventRegistrantsListPath } from "@/lib/admin/event-registrants-paths";
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
      ticketRole: true,
      ticketPriceType: true,
      ticketPriceApplied: true,
      mandatoryMenuPriceApplied: true,
      event: {
        select: { ticketMemberPrice: true, ticketNonMemberPrice: true },
      },
    },
  });

  if (!reg || reg.eventId !== eventId) {
    return rootError("Pendaftaran tidak ditemukan.");
  }

  if (reg.ticketRole !== TicketRole.primary) {
    return rootError("Hanya tiket utama yang dapat di-override di sini.");
  }

  let adjustmentCreated = false;

  await prisma.$transaction(async (tx) => {
    await tx.registration.update({
      where: { id: registrationId },
      data: { memberValidation: validation },
    });

    if (
      newPrimaryPriceType &&
      newPrimaryPriceType !== reg.ticketPriceType &&
      (newPrimaryPriceType === "member" || newPrimaryPriceType === "non_member")
    ) {
      const newTicketPrice =
        newPrimaryPriceType === "member"
          ? reg.event.ticketMemberPrice
          : reg.event.ticketNonMemberPrice;
      const delta = newTicketPrice - reg.ticketPriceApplied;

      await tx.registration.update({
        where: { id: registrationId },
        data: {
          ticketPriceType: newPrimaryPriceType,
          ticketPriceApplied: newTicketPrice,
          computedTotalAtSubmit: newTicketPrice + reg.mandatoryMenuPriceApplied,
        },
      });

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

  revalidatePath(eventRegistrantsListPath(eventId));
  revalidatePath(eventRegistrationDetailPath(eventId, registrationId));
  return ok({ adjustmentCreated });
}
