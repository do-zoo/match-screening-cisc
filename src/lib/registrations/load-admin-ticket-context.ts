import type { TicketPriceType, TicketRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getActiveMasterMemberByMemberNumber } from "@/lib/members/lookup-master-member";

import {
  aggregateCrossRegistrationConflicts,
  partnerSummaryFromTickets,
  resolvePrimaryMemberNumberForDirectoryLookup,
  type TicketContextVm,
} from "./admin-ticket-context";

type RegistrationForContext = {
  id: string;
  claimedMemberNumber: string | null;
  tickets: Array<{
    role: TicketRole;
    fullName: string;
    whatsapp: string | null;
    memberNumber: string | null;
    ticketPriceType: TicketPriceType;
  }>;
};

export async function loadTicketContextVm(input: {
  eventId: string;
  registration: RegistrationForContext;
}): Promise<Extract<TicketContextVm, { kind: "ok" }>> {
  const { eventId, registration } = input;

  const partner = partnerSummaryFromTickets(registration.tickets);

  const primaryNum = resolvePrimaryMemberNumberForDirectoryLookup(
    registration.tickets,
    registration.claimedMemberNumber,
  );

  let pengurus: Extract<TicketContextVm, { kind: "ok" }>["pengurus"];
  if (!primaryNum) {
    pengurus = { state: "no_primary_number" };
  } else {
    const row = await getActiveMasterMemberByMemberNumber(primaryNum);
    if (!row) {
      pengurus = { state: "not_in_directory" };
    } else {
      pengurus = { state: "found", isPengurus: row.isPengurus };
    }
  }

  const nums = [
    ...new Set(
      registration.tickets
        .map((t) => t.memberNumber?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ];

  let conflictsFlat: Array<{
    registrationId: string;
    contactName: string;
    memberNumber: string;
  }> = [];

  if (nums.length > 0) {
    const otherTickets = await prisma.ticket.findMany({
      where: {
        eventId,
        registrationId: { not: registration.id },
        memberNumber: { in: nums },
      },
      select: {
        memberNumber: true,
        registration: {
          select: { id: true, contactName: true },
        },
      },
    });

    conflictsFlat = otherTickets
      .filter((t) => t.memberNumber !== null)
      .map((t) => ({
        registrationId: t.registration.id,
        contactName: t.registration.contactName,
        memberNumber: t.memberNumber as string,
      }));
  }

  const conflicts = aggregateCrossRegistrationConflicts(conflictsFlat);

  return {
    kind: "ok",
    partner,
    pengurus,
    conflicts,
  };
}
