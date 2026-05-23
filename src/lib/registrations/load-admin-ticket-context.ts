import { prisma } from '@/lib/db/prisma'

import { aggregateCrossRegistrationConflicts, type TicketContextVm } from './admin-ticket-context'

type RegistrationForContext = {
  id: string
  holders: Array<{ claimedMemberNumber: string | null }>
}

export async function loadTicketContextVm(input: {
  eventId: string
  registration: RegistrationForContext
}): Promise<Extract<TicketContextVm, { kind: 'ok' }>> {
  const { eventId, registration } = input

  const nums = [
    ...new Set(registration.holders.map(h => h.claimedMemberNumber?.trim()).filter((n): n is string => Boolean(n))),
  ]

  let conflictsFlat: Array<{
    registrationId: string
    contactName: string
    memberNumber: string
  }> = []

  if (nums.length > 0) {
    const holderConflicts = await prisma.registrationHolder.findMany({
      where: {
        claimedMemberNumber: { in: nums },
        registration: {
          eventId,
          id: { not: registration.id },
        },
      },
      select: {
        claimedMemberNumber: true,
        registration: { select: { id: true, contactName: true } },
      },
    })

    conflictsFlat = holderConflicts
      .filter(h => h.claimedMemberNumber)
      .map(h => ({
        registrationId: h.registration.id,
        contactName: h.registration.contactName,
        memberNumber: h.claimedMemberNumber as string,
      }))
  }

  const conflicts = aggregateCrossRegistrationConflicts(conflictsFlat)

  return {
    kind: 'ok',
    conflicts,
  }
}
