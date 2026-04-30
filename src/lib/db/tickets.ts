import type { Prisma, TicketPriceType, TicketRole } from "@prisma/client";

export function buildTicketCreateData(input: {
  registrationId: string;
  eventId: string;
  role: TicketRole;
  fullName: string;
  whatsapp?: string;
  memberNumber?: string;
  ticketPriceType: TicketPriceType;
}): Prisma.TicketCreateInput {
  return {
    registration: { connect: { id: input.registrationId } },
    eventId: input.eventId,
    role: input.role,
    fullName: input.fullName,
    whatsapp: input.whatsapp,
    memberNumber: input.memberNumber,
    ticketPriceType: input.ticketPriceType,
  };
}