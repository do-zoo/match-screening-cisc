import type { TicketPriceType, TicketRole } from "@prisma/client";

export function resolvePrimaryMemberNumberForDirectoryLookup(
  tickets: ReadonlyArray<{ role: TicketRole; memberNumber: string | null }>,
  claimedMemberNumber: string | null,
): string | null {
  const primary = tickets.find((t) => t.role === "primary");
  const fromTicket = primary?.memberNumber?.trim();
  if (fromTicket) return fromTicket;
  const c = claimedMemberNumber?.trim();
  return c ? c : null;
}

export function formatTicketPriceTypeLabel(t: TicketPriceType): string {
  if (t === "member") return "Member";
  if (t === "non_member") return "Non-member";
  return "Harga istimewa (tiket partner)";
}

export function partnerSummaryFromTickets(
  tickets: ReadonlyArray<{
    role: TicketRole;
    fullName: string;
    whatsapp: string | null;
    memberNumber: string | null;
    ticketPriceType: TicketPriceType;
  }>,
):
  | {
      fullName: string;
      whatsapp: string | null;
      memberNumber: string | null;
      ticketPriceType: TicketPriceType;
      ticketPriceTypeLabel: string;
    }
  | null {
  const p = tickets.find((t) => t.role === "partner");
  if (!p) return null;
  return {
    fullName: p.fullName,
    whatsapp: p.whatsapp,
    memberNumber: p.memberNumber,
    ticketPriceType: p.ticketPriceType,
    ticketPriceTypeLabel: formatTicketPriceTypeLabel(p.ticketPriceType),
  };
}

/** Rows must already exclude the current registration (query responsibility). */
export function aggregateCrossRegistrationConflicts(
  rows: ReadonlyArray<{
    registrationId: string;
    contactName: string;
    memberNumber: string;
  }>,
): Array<{
  registrationId: string;
  contactName: string;
  memberNumbers: string[];
}> {
  const map = new Map<string, { contactName: string; nums: Set<string> }>();

  for (const r of rows) {
    const id = r.registrationId;
    let e = map.get(id);
    if (!e) {
      e = { contactName: r.contactName, nums: new Set() };
      map.set(id, e);
    }
    e.nums.add(r.memberNumber);
  }

  return [...map.entries()]
    .map(([registrationId, v]) => ({
      registrationId,
      contactName: v.contactName,
      memberNumbers: [...v.nums].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.contactName.localeCompare(b.contactName, "id"));
}

export type TicketContextPengurusVm =
  | { state: "no_primary_number" }
  | { state: "not_in_directory" }
  | { state: "found"; isPengurus: boolean };

export type TicketConflictRowVm = {
  registrationId: string;
  contactName: string;
  memberNumbers: string[];
};

export type TicketContextVm =
  | {
      kind: "ok";
      partner: {
        fullName: string;
        whatsapp: string | null;
        memberNumber: string | null;
        ticketPriceType: TicketPriceType;
        ticketPriceTypeLabel: string;
      } | null;
      pengurus: TicketContextPengurusVm;
      conflicts: TicketConflictRowVm[];
    }
  | { kind: "error"; message: string };
