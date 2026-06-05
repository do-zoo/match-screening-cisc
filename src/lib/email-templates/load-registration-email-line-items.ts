import {
  buildTicketLineItems,
  type EmailTransactionLineItem,
  type RegistrationTicketForEmailLineItem,
} from '@/lib/email-templates/email-transaction-line-items'
import { prisma } from '@/lib/db/prisma'

const ticketSelect = {
  orderBy: { sortOrder: 'asc' as const },
  select: {
    sortOrder: true,
    ticketPriceApplied: true,
    assignedHolder: { select: { holderName: true } },
    mandatoryMenuItem: { select: { name: true } },
  },
}

export async function loadRegistrationTicketLineItems(
  registrationId: string,
): Promise<EmailTransactionLineItem[]> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { tickets: ticketSelect },
  })
  if (!reg?.tickets.length) return []
  return buildTicketLineItems(reg.tickets as RegistrationTicketForEmailLineItem[])
}
