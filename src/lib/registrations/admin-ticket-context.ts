import type { MemberValidation } from '@prisma/client'

export type RegistrationHolderContext = {
  id: string
  sortOrder: number
  holderName: string
  claimedMemberNumber: string | null
  memberValidation: MemberValidation
  ticketPriceApplied: number
  menuItemName: string | null
}

export type TicketConflictRowVm = {
  registrationId: string
  contactName: string
  memberNumbers: string[]
}

export type TicketContextVm =
  | {
      kind: 'ok'
      conflicts: TicketConflictRowVm[]
    }
  | { kind: 'error'; message: string }

/** Returns member numbers that appear in other approved/pending registrations for the same event. */
export function aggregateCrossRegistrationConflicts(
  rows: ReadonlyArray<{
    registrationId: string
    contactName: string
    memberNumber: string
  }>,
): Array<{
  registrationId: string
  contactName: string
  memberNumbers: string[]
}> {
  const map = new Map<string, { contactName: string; nums: Set<string> }>()
  for (const r of rows) {
    const id = r.registrationId
    let e = map.get(id)
    if (!e) {
      e = { contactName: r.contactName, nums: new Set() }
      map.set(id, e)
    }
    e.nums.add(r.memberNumber)
  }
  return [...map.entries()]
    .map(([registrationId, v]) => ({
      registrationId,
      contactName: v.contactName,
      memberNumbers: [...v.nums].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.contactName.localeCompare(b.contactName, 'id'))
}
