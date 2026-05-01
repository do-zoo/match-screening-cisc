"use server";

import { revalidatePath } from "next/cache";

import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import {
  guardOwner,
  isAuthError,
  type OwnerGuardContext,
} from "@/lib/actions/guard";
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
  let owner: OwnerGuardContext;
  try {
    owner = await guardOwner();
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

  await appendClubAuditLog(prisma, {
    actorProfileId: owner.profileId,
    actorAuthUserId: owner.authUserId,
    action: CLUB_AUDIT_ACTION.COMMITTEE_PRICING_SAVED,
    targetType: "committee_ticket_defaults",
    targetId: COMMITTEE_TICKET_DEFAULTS_KEY,
    metadata: { ticketMemberPrice, ticketNonMemberPrice },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/pricing");
  return ok({ saved: true });
}
