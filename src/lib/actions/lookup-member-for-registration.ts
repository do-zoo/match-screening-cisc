'use server'

import { RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type MemberLookupResult =
  | { status: 'not_found' }
  | { status: 'already_registered' }
  | { status: 'valid'; fullName: string; whatsapp: string | null }

const ACTIVE_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.submitted,
  RegistrationStatus.pending_review,
  RegistrationStatus.approved,
]

export async function lookupMemberForRegistration(memberNumber: string, eventId: string): Promise<MemberLookupResult> {
  const trimmed = memberNumber.trim()
  if (!trimmed) return { status: 'not_found' }

  const [member, duplicate] = await Promise.all([
    prisma.masterMember.findUnique({
      where: { memberNumber: trimmed },
      select: { id: true, fullName: true, whatsapp: true },
    }),
    prisma.registrationHolder.findFirst({
      where: {
        claimedMemberNumber: trimmed,
        registration: {
          eventId,
          status: { in: ACTIVE_STATUSES },
        },
      },
      select: { id: true },
    }),
  ])

  if (!member) return { status: 'not_found' }
  if (duplicate) return { status: 'already_registered' }
  return { status: 'valid', fullName: member.fullName, whatsapp: member.whatsapp }
}
