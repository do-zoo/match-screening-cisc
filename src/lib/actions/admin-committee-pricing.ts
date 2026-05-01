"use server";

import { revalidatePath } from "next/cache";

import { guardOwner, isAuthError } from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import { COMMITTEE_TICKET_DEFAULTS_KEY } from "@/lib/events/event-admin-defaults";
import { committeeDefaultPricingFormSchema } from "@/lib/forms/committee-default-pricing-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";

export async function saveCommitteeDefaultTicketPrices(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  try {
    await guardOwner();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const raw = {
    ticketMemberPrice: formData.get("ticketMemberPrice"),
    ticketNonMemberPrice: formData.get("ticketNonMemberPrice"),
  };

  const parsed = committeeDefaultPricingFormSchema.safeParse(raw);
  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error));
  }

  const { ticketMemberPrice, ticketNonMemberPrice } = parsed.data;

  try {
    await prisma.committeeTicketDefaults.upsert({
      where: { singletonKey: COMMITTEE_TICKET_DEFAULTS_KEY },
      create: {
        singletonKey: COMMITTEE_TICKET_DEFAULTS_KEY,
        ticketMemberPrice,
        ticketNonMemberPrice,
      },
      update: { ticketMemberPrice, ticketNonMemberPrice },
    });
  } catch {
    return rootError("Tidak dapat menyimpan pengaturan. Coba lagi.");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/pricing");
  return ok({ saved: true });
}
