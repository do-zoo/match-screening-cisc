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
  primaryManagementMemberId: string | null;
  claimedManagementPublicCode: string | null;
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

  const nums = [
    ...new Set(
      registration.tickets
        .map((t) => t.memberNumber?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ];

  const excludeIds = new Set<string>([registration.id]);
  const groupRow = await prisma.registration.findUnique({
    where: { id: registration.id },
    select: {
      primaryRegistrationId: true,
      partnerRegistrations: { select: { id: true } },
    },
  });
  if (groupRow?.primaryRegistrationId) {
    excludeIds.add(groupRow.primaryRegistrationId);
  }
  for (const p of groupRow?.partnerRegistrations ?? []) {
    excludeIds.add(p.id);
  }

  let conflictsFlat: Array<{
    registrationId: string;
    contactName: string;
    memberNumber: string;
  }> = [];

  if (nums.length > 0) {
    const exclude = [...excludeIds];
    const fromRegs = await prisma.registration.findMany({
      where: {
        eventId,
        claimedMemberNumber: { in: nums },
        id: { notIn: exclude },
      },
      select: {
        id: true,
        contactName: true,
        claimedMemberNumber: true,
      },
    });

    conflictsFlat = fromRegs
      .filter((r) => r.claimedMemberNumber)
      .map((r) => ({
        registrationId: r.id,
        contactName: r.contactName,
        memberNumber: r.claimedMemberNumber as string,
      }));
  }

  const conflicts = aggregateCrossRegistrationConflicts(conflictsFlat);

  if (registration.primaryManagementMemberId) {
    const mm = await prisma.managementMember.findUnique({
      where: { id: registration.primaryManagementMemberId },
      select: { fullName: true, publicCode: true },
    });
    const publicCode =
      registration.claimedManagementPublicCode?.trim() ||
      mm?.publicCode ||
      "";
    return {
      kind: "ok",
      partner,
      managementMember: {
        state: "via_public_code",
        publicCode,
        fullName: mm?.fullName ?? "—",
      },
      conflicts,
    };
  }

  const primaryNum = resolvePrimaryMemberNumberForDirectoryLookup(
    registration.tickets,
    registration.claimedMemberNumber,
  );

  let managementMember: Extract<
    TicketContextVm,
    { kind: "ok" }
  >["managementMember"];
  if (!primaryNum) {
    managementMember = { state: "no_primary_number" };
  } else {
    const row = await getActiveMasterMemberByMemberNumber(primaryNum);
    if (!row) {
      managementMember = { state: "not_in_directory" };
    } else {
      managementMember = {
        state: "found",
        isManagementMember: row.isManagementMember,
      };
    }
  }

  return {
    kind: "ok",
    partner,
    managementMember,
    conflicts,
  };
}
